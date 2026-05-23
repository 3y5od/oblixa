import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/decisions/[id]/approve";

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
    apiPath: "/api/decisions/[id]/approve",
  });
  if (modeGate) return modeGate;
  const duplicate = await enforceIdempotency(request, {
    scope: "decisions.approve",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/[id]/approve",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{ note?: string }>(raw, {});
  const note = toSafeString(body.note);

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]/approve");

  if (routeParamRejection) return routeParamRejection;
  const { data: current } = await ctx.admin
    .from("decision_workspaces")
    .select("status")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!current) return jsonNotFound(ROUTE);
  if (!["open", "in_review"].includes(current.status)) {
    return jsonProblem(409, {
      error: "Only open or in_review decisions can be approved",
      code: "decision_approval_invalid_status",
      diagnostic_id: "decision_approval_invalid_status",
      route: ROUTE,
    });
  }

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .update({ status: "approved" })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .in("status", ["open", "in_review"])
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "decision_approval_failed",
      diagnostic_id: "decision_approval_failed",
      route: ROUTE,
    });
  }
  if (!data) {
    return jsonProblem(409, {
      error: "Decision status changed before approval",
      code: "decision_approval_stale_status",
      diagnostic_id: "decision_approval_stale_status",
      route: ROUTE,
    });
  }

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.approved",
    payload_json: {
      prior_status: current.status,
      note: note || undefined,
    },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ decision: data });
}
