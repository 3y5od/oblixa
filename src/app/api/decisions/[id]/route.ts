import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import {
  decisionTypeValidationError,
  isValidDecisionType,
  mergeRequiredInputs,
} from "@/lib/v5/decision-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { parseIsoTimestampParam } from "@/lib/security/validation";

const ROUTE = "/api/decisions/[id]";
const DECISION_DUE_AT_WINDOW_DAYS = 3660;

function parseDecisionDueAt(value: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  const raw = toSafeString(value);
  if (!raw) return { ok: true, value: null };
  const parsed = parseIsoTimestampParam(raw, {
    maxLookbackDays: DECISION_DUE_AT_WINDOW_DAYS,
    maxFutureSkewMinutes: DECISION_DUE_AT_WINDOW_DAYS * 24 * 60,
  });
  if (!parsed.ok) return { ok: false };
  return { ok: true, value: parsed.value ?? null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]");

  if (routeParamRejection) return routeParamRejection;
  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .select(
      "id, title, decision_type, status, linked_contract_ids, linked_account_key, linked_counterparty_key, owner_user_id, due_at, required_inputs_json, approval_path_json, recommendation_json, rationale_markdown, final_disposition_json, post_decision_actions_json, metadata_json, updated_at"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[api/decisions/[id]] GET error:", error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "decision_lookup_failed",
      diagnostic_id: "decision_lookup_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);

  const [
    { data: stakeholders },
    { data: events },
    { data: recommendations },
    { data: packetRuns },
  ] = await Promise.all([
    ctx.admin
      .from("decision_workspace_stakeholders")
      .select("id, stakeholder_user_id, stakeholder_role, status, notes, responded_at")
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: true }),
    ctx.admin
      .from("decision_workspace_events")
      .select("id, event_type, payload_json, actor_user_id, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    ctx.admin
      .from("decision_recommendations")
      .select(
        "id, recommendation_type, recommendation_text, confidence, reasons_json, source_object_refs_json, accepted, created_at"
      )
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false }),
    ctx.admin
      .from("decision_packet_runs")
      .select("id, packet_type, exported_at, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    decision: data,
    stakeholders: stakeholders ?? [],
    events: events ?? [],
    recommendations: recommendations ?? [],
    packetRuns: packetRuns ?? [],
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    apiPath: "/api/decisions/[id]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions.id",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/[id]",
    method: "PATCH",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    title?: string;
    decisionType?: string;
    dueAt?: string | null;
    ownerUserId?: string | null;
    rationaleMarkdown?: string | null;
    requiredInputs?: Record<string, unknown>;
    mergeRequiredInputs?: boolean;
    approvalPath?: unknown[];
    status?: string;
  }>(raw, {});

  const patch: Record<string, unknown> = {};
  const { id } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]");
  if (routeParamRejection) return routeParamRejection;
  if (body.title !== undefined) {
    const t = toSafeString(body.title);
    if (!t) {
      return jsonProblem(400, {
        error: "title cannot be empty",
        code: "title_empty",
        diagnostic_id: "decision_title_empty",
        route: ROUTE,
      });
    }
    patch.title = t;
  }
  if (body.decisionType !== undefined) {
    const dt = toSafeString(body.decisionType);
    if (!dt || !isValidDecisionType(dt)) {
      return jsonProblem(400, {
        error: decisionTypeValidationError(),
        code: "invalid_decision_type",
        diagnostic_id: "decision_type_invalid",
        route: ROUTE,
      });
    }
    patch.decision_type = dt;
  }
  if (body.dueAt !== undefined) {
    const dueAt = parseDecisionDueAt(body.dueAt);
    if (!dueAt.ok) {
      return jsonProblem(400, {
        error: "dueAt must be a bounded UTC ISO timestamp",
        code: "invalid_due_at",
        diagnostic_id: "decision_due_at_invalid",
        route: ROUTE,
      });
    }
    patch.due_at = dueAt.value;
  }
  if (body.ownerUserId !== undefined) {
    patch.owner_user_id = body.ownerUserId === null || body.ownerUserId === "" ? null : body.ownerUserId;
  }
  if (body.rationaleMarkdown !== undefined) {
    patch.rationale_markdown =
      body.rationaleMarkdown === null ? null : toSafeString(body.rationaleMarkdown);
  }
  if (body.requiredInputs !== undefined) {
    if (body.mergeRequiredInputs) {
      const { data: prior } = await ctx.admin
        .from("decision_workspaces")
        .select("required_inputs_json")
        .eq("organization_id", ctx.orgId)
        .eq("id", id)
        .maybeSingle();
      patch.required_inputs_json = mergeRequiredInputs(prior?.required_inputs_json, body.requiredInputs);
    } else {
      patch.required_inputs_json =
        body.requiredInputs && typeof body.requiredInputs === "object" ? body.requiredInputs : {};
    }
  }
  if (body.approvalPath !== undefined) {
    patch.approval_path_json = Array.isArray(body.approvalPath) ? body.approvalPath : [];
  }
  if (body.status !== undefined) {
    const s = toSafeString(body.status);
    if (s && ["draft", "open", "in_review"].includes(s)) {
      patch.status = s;
    } else if (s) {
      return jsonProblem(400, {
        error: "status may only be set to draft, open, or in_review via PATCH",
        code: "invalid_status",
        diagnostic_id: "decision_status_invalid",
        route: ROUTE,
      });
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonProblem(400, {
      error: "No valid fields to update",
      code: "no_valid_fields",
      diagnostic_id: "decision_no_valid_fields",
      route: ROUTE,
    });
  }

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "decision",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .eq("updated_at", expectedVersionResult.expectedVersion)
    .select(
      "id, title, decision_type, status, owner_user_id, due_at, required_inputs_json, approval_path_json, rationale_markdown, updated_at"
    )
    .maybeSingle();
  if (error) {
    console.error("[api/decisions/[id]] PATCH error:", error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "decision_update_failed",
      diagnostic_id: "decision_update_failed",
      route: ROUTE,
    });
  }
  if (!data) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "decision",
    });
  }

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.updated",
    payload_json: { fields: Object.keys(patch) },
    actor_user_id: ctx.userId,
  });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  return NextResponse.json({ decision: data });
}
