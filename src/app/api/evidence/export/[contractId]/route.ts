import { NextResponse } from "next/server";
import { jsonNotFound, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import {
  contentDispositionAttachment,
  sanitizeExportFileName,
  sanitizeExportFileNameToken,
} from "@/lib/security/export-filename";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/evidence/export/[contractId]";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/evidence/export/[contractId]",
  });
  if (modeGate) return modeGate;

  const { contractId } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ contractId }, ["contractId"], "/api/evidence/export/[contractId]");

  if (routeParamRejection) return routeParamRejection;
  void recordApiRouteAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  const { data: contract } = await ctx.admin
    .from("contracts")
    .select("id, title")
    .eq("id", contractId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!contract) return jsonNotFound(ROUTE);

  const [{ data: requirements }, { data: attestationRequests }] = await Promise.all([
    ctx.admin
      .from("evidence_requirements")
      .select(
        "id, work_item_type, work_item_id, requirement_type, title, required, due_at, review_due_at, status, config_json, created_at, updated_at"
      )
      .eq("organization_id", ctx.orgId)
      .eq("contract_id", contractId),
    ctx.admin
      .from("attestation_requests")
      .select(
        "id, request_type, title, details, status, due_at, owner_id, reviewer_id, created_at, updated_at"
      )
      .eq("organization_id", ctx.orgId)
      .eq("contract_id", contractId),
  ]);

  const reqIds = (requirements ?? []).map((r) => r.id);
  const { data: submissions } =
    reqIds.length === 0
      ? { data: [] as Record<string, unknown>[] }
      : await ctx.admin
          .from("evidence_submissions")
          .select(
            "id, requirement_id, submitted_by, submitted_at, status, payload_json, reviewer_id, reviewed_at, rejection_reason"
          )
          .eq("organization_id", ctx.orgId)
          .in("requirement_id", reqIds);

  const attIds = (attestationRequests ?? []).map((a) => a.id);
  const { data: attestationResponses } =
    attIds.length === 0
      ? { data: [] as Record<string, unknown>[] }
      : await ctx.admin
          .from("attestation_responses")
          .select("id, request_id, responder_id, response_type, response_note, payload_json, responded_at")
          .eq("organization_id", ctx.orgId)
          .in("request_id", attIds);

  const templatesResult = await ctx.admin
    .from("evidence_requirement_templates")
    .select("id, name, requirement_type, template_json, created_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  const templates = templatesResult.error ? [] : templatesResult.data ?? [];

  const pack = {
    schema: "oblixa.evidence_pack.v1",
    exported_at: new Date().toISOString(),
    contract: { id: contract.id, title: contract.title },
    evidence_requirements: requirements ?? [],
    evidence_submissions: submissions ?? [],
    attestation_requests: attestationRequests ?? [],
    attestation_responses: attestationResponses ?? [],
    templates_snapshot: templates,
  };

  const body = JSON.stringify(pack, null, 2);
  const fileName = sanitizeExportFileName(`evidence-pack-${sanitizeExportFileNameToken(contractId)}.json`);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": contentDispositionAttachment(fileName),
      "cache-control": "private, no-store",
    },
  });
}
