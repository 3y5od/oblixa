import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { nowIso, readJsonBody, toSafeString } from "@/lib/v5/api";
import { decisionQueueSlaFields } from "@/lib/v5/decision-queue-sla";
import {
  isValidPacketType,
  PACKET_TYPE_TEMPLATE_HINTS,
  packetTypeValidationError,
} from "@/lib/v5/packet-types";
import { buildDecisionExecutionContext } from "@/lib/v5/decision-context";
import {
  uploadDecisionPacketJsonArtifact,
  uploadDecisionPacketPdfArtifact,
} from "@/lib/v5/decision-packet-storage";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { enforceIdempotency } from "@/lib/idempotency";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE = "/api/decisions/[id]/packet";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]/packet",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]/packet");

  if (routeParamRejection) return routeParamRejection;
  const duplicate = await enforceIdempotency(request, {
    scope: "decision.packet.create",
    actorKey: `${ctx.orgId}:${ctx.userId}:${id}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/[id]/packet",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{ packetType?: string; packetTemplateId?: string; reportPackId?: string }>(
    raw,
    {}
  );
  const rawPacketType = toSafeString(body.packetType) || "renewal_packet";
  if (!isValidPacketType(rawPacketType)) {
    return jsonProblem(400, {
      error: packetTypeValidationError(),
      code: "invalid_packet_type",
      diagnostic_id: "decision_packet_type_invalid",
      route: ROUTE,
    });
  }
  const packetType = rawPacketType;
  const templateId = toSafeString(body.packetTemplateId);
  const reportPackRaw = toSafeString(body.reportPackId);
  const reportPackId = UUID_RE.test(reportPackRaw) ? reportPackRaw : "";

  const { data: decision, error: decErr } = await ctx.admin
    .from("decision_workspaces")
    .select(
      "id, title, decision_type, status, linked_contract_ids, rationale_markdown, recommendation_json, final_disposition_json, due_at, linked_account_key, linked_counterparty_key"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (decErr) {
    return jsonProblem(400, {
      error: decErr.message,
      code: "decision_packet_lookup_failed",
      diagnostic_id: "decision_packet_lookup_failed",
      route: ROUTE,
    });
  }
  if (!decision) return jsonNotFound(ROUTE);

  const contractIds = Array.isArray(decision.linked_contract_ids)
    ? decision.linked_contract_ids.filter(Boolean)
    : [];
  let contractsSummary: { id: string; title: string | null }[] = [];
  if (contractIds.length > 0) {
    const { data: contracts } = await ctx.admin
      .from("contracts")
      .select("id, title")
      .eq("organization_id", ctx.orgId)
      .in("id", contractIds.slice(0, 50));
    contractsSummary = contracts ?? [];
  }

  const executionContext = await buildDecisionExecutionContext(
    ctx.admin,
    ctx.orgId,
    decision.linked_contract_ids
  );

  const { data: recentEvents } = await ctx.admin
    .from("decision_workspace_events")
    .select("event_type, payload_json, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("decision_workspace_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  let linkedReportPack: Record<string, unknown> | null = null;
  if (reportPackId) {
    const { data: rp } = await ctx.admin
      .from("report_packs")
      .select("id, title, status, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("id", reportPackId)
      .maybeSingle();
    if (rp) {
      linkedReportPack = {
        id: rp.id,
        title: rp.title,
        status: rp.status,
        updated_at: rp.updated_at,
      };
    }
  }

  let packetTemplateId: string | null = null;
  let templateOverlay: Record<string, unknown> = {};
  if (templateId) {
    const { data: tpl } = await ctx.admin
      .from("decision_packet_templates")
      .select("id, template_json")
      .eq("organization_id", ctx.orgId)
      .eq("id", templateId)
      .maybeSingle();
    if (tpl?.id) {
      packetTemplateId = tpl.id;
      templateOverlay =
        tpl.template_json && typeof tpl.template_json === "object" && !Array.isArray(tpl.template_json)
          ? (tpl.template_json as Record<string, unknown>)
          : {};
    }
  }

  let managerQueueSnapshot: Record<string, unknown>[] | undefined;
  if (packetType === "manager_review_packet") {
    const { data: queueRows, error: queueErr } = await ctx.admin
      .from("decision_workspaces")
      .select("id, title, decision_type, status, due_at, owner_user_id, updated_at")
      .eq("organization_id", ctx.orgId)
      .in("status", ["open", "in_review"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(40);
    if (!queueErr && queueRows?.length) {
      managerQueueSnapshot = queueRows.map((row) => {
        const sla = decisionQueueSlaFields(row.due_at);
        return {
          id: row.id,
          title: row.title,
          decision_type: row.decision_type,
          status: row.status,
          due_at: row.due_at,
          owner_user_id: row.owner_user_id,
          updated_at: row.updated_at,
          sla_status: sla.sla_status,
          days_until_due: sla.days_until_due,
          priority: sla.priority,
        };
      });
    }
  }

  const payloadJson: Record<string, unknown> = {
    generated_at: nowIso(),
    packet_type: packetType,
    template_catalog_hint: PACKET_TYPE_TEMPLATE_HINTS[packetType],
    decision: {
      title: decision.title,
      decision_type: decision.decision_type,
      status: decision.status,
      due_at: decision.due_at,
      linked_account_key: decision.linked_account_key,
      linked_counterparty_key: decision.linked_counterparty_key,
    },
    key_dates: {
      workspace_due_at: decision.due_at,
      generated_at: nowIso(),
    },
    execution_blockers: executionContext.counts,
    recent_workspace_events: (recentEvents ?? []).map((e) => ({
      event_type: e.event_type,
      created_at: e.created_at,
      payload_json: e.payload_json,
    })),
    rationale_markdown: decision.rationale_markdown,
    recommendation_json: decision.recommendation_json,
    final_disposition_json: decision.final_disposition_json,
    linked_contracts: contractsSummary,
    template_overlay: templateOverlay,
    linked_report_pack: linkedReportPack,
  };
  if (managerQueueSnapshot?.length) {
    payloadJson.manager_queue_snapshot = managerQueueSnapshot;
  }

  const { data: run, error: runErr } = await ctx.admin
    .from("decision_packet_runs")
    .insert({
      organization_id: ctx.orgId,
      decision_workspace_id: id,
      packet_template_id: packetTemplateId,
      packet_type: packetType,
      payload_json: payloadJson,
      exported_at: nowIso(),
      created_by: ctx.userId,
    })
    .select("id, packet_type, payload_json, exported_at, created_at")
    .single();
  if (runErr) {
    return jsonProblem(400, {
      error: runErr.message,
      code: "decision_packet_create_failed",
      diagnostic_id: "decision_packet_create_failed",
      route: ROUTE,
    });
  }

  const decisionTitle =
    typeof decision.title === "string" && decision.title.trim()
      ? decision.title
      : "Decision packet";
  const { renderDecisionPacketPdfBuffer } = await import("@/lib/v5/decision-packet-pdf");
  const packetPdfBuffer = await renderDecisionPacketPdfBuffer({
    title: decisionTitle,
    packetType: packetType,
    exportedAt: run.exported_at ?? nowIso(),
    bodyText: JSON.stringify(payloadJson, null, 2),
  });

  const jsonUploadResult = await uploadDecisionPacketJsonArtifact(ctx.admin, {
    orgId: ctx.orgId,
    runId: run.id,
    payload: payloadJson,
  });
  const pdfUploadResult = await uploadDecisionPacketPdfArtifact(ctx.admin, {
    orgId: ctx.orgId,
    runId: run.id,
    pdfBuffer: packetPdfBuffer,
  });

  if (jsonUploadResult || pdfUploadResult || reportPackId) {
    await ctx.admin
      .from("decision_packet_runs")
      .update({
        artifact_storage_path: jsonUploadResult && !('error' in jsonUploadResult) ? jsonUploadResult.storagePath : null,
        artifact_content_type: "application/json; charset=utf-8",
        artifact_generated_at: nowIso(),
        artifact_pdf_storage_path: pdfUploadResult && !('error' in pdfUploadResult) ? pdfUploadResult.storagePath : null,
        artifact_pdf_generated_at: nowIso(),
        report_pack_id: reportPackId || null,
      })
      .eq("organization_id", ctx.orgId)
      .eq("id", run.id);
  }

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.packet_exported",
    payload_json: { packet_run_id: run.id, packet_type: run.packet_type },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json(
    {
      packetRun: run,
      artifactStored: Boolean(jsonUploadResult || pdfUploadResult),
      artifacts: {
        jsonStored: Boolean(jsonUploadResult),
        pdfStored: Boolean(pdfUploadResult),
      },
    },
    { status: 201 }
  );
}
