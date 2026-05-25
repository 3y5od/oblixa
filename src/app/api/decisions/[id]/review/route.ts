import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/decisions/[id]/review";

function nextStatusForAction(action: string): "approved" | "open" | null {
  if (action === "approve") return "approved";
  if (action === "return_for_revision") return "open";
  if (action === "reject") return "open";
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "approvals_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]/review",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions.id.review",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/[id]/review",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{ action?: string; note?: string }>(raw, {});
  const action = toSafeString(body.action).toLowerCase();
  const note = toSafeString(body.note);
  const status = nextStatusForAction(action);
  if (!status) {
    return jsonProblem(400, {
      error: "action must be one of: approve, reject, return_for_revision",
      code: "invalid_review_action",
      diagnostic_id: "decision_review_action_invalid",
      route: ROUTE,
    });
  }

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]/review");

  if (routeParamRejection) return routeParamRejection;
  const { data: prior, error: priorError } = await ctx.admin
    .from("decision_workspaces")
    .select("id, status, title, owner_user_id")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (priorError) {
    return jsonProblem(400, {
      error: priorError.message,
      code: "decision_review_lookup_failed",
      diagnostic_id: "decision_review_lookup_failed",
      route: ROUTE,
    });
  }
  if (!prior) return jsonNotFound(ROUTE);
  if (!["open", "in_review"].includes(prior.status)) {
    return jsonProblem(409, {
      error: "Only open or in_review decisions are review-actionable",
      code: "decision_review_invalid_status",
      diagnostic_id: "decision_review_invalid_status",
      route: ROUTE,
    });
  }

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .update({ status })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "decision_review_update_failed",
      diagnostic_id: "decision_review_update_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);

  const eventType =
    action === "approve"
      ? "decision.review_approved"
      : action === "reject"
        ? "decision.review_rejected"
        : "decision.review_returned";

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: eventType,
    payload_json: {
      prior_status: prior.status,
      next_status: status,
      action,
      note: note || undefined,
    },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ decision: data });
}
