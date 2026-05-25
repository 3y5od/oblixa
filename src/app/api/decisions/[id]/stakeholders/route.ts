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

const ROUTE = "/api/decisions/[id]/stakeholders";

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
    apiPath: "/api/decisions/[id]/stakeholders",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions.id.stakeholders",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions/[id]/stakeholders",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    stakeholderUserId?: string;
    stakeholderRole?: string;
    notes?: string;
  }>(raw, {});
  const stakeholderUserId = toSafeString(body.stakeholderUserId);
  if (!stakeholderUserId) {
    return jsonProblem(400, {
      error: "stakeholderUserId is required",
      code: "stakeholder_user_id_required",
      diagnostic_id: "decision_stakeholder_user_id_required",
      route: ROUTE,
    });
  }

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/decisions/[id]/stakeholders");

  if (routeParamRejection) return routeParamRejection;
  const { data: exists } = await ctx.admin
    .from("decision_workspaces")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!exists) return jsonNotFound(ROUTE);

  const { data: memberCheck } = await ctx.admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", stakeholderUserId)
    .maybeSingle();
  if (!memberCheck) {
    return jsonProblem(400, {
      error: "Stakeholder must be an organization member",
      code: "stakeholder_not_org_member",
      diagnostic_id: "decision_stakeholder_not_org_member",
      route: ROUTE,
    });
  }

  const { data, error } = await ctx.admin
    .from("decision_workspace_stakeholders")
    .insert({
      organization_id: ctx.orgId,
      decision_workspace_id: id,
      stakeholder_user_id: stakeholderUserId,
      stakeholder_role: toSafeString(body.stakeholderRole) || "reviewer",
      notes: toSafeString(body.notes) || null,
    })
    .select("id, stakeholder_user_id, stakeholder_role, status, notes, created_at")
    .single();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "decision_stakeholder_create_failed",
      diagnostic_id: "decision_stakeholder_create_failed",
      route: ROUTE,
    });
  }

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.stakeholder_added",
    payload_json: { stakeholder_id: data.id },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ stakeholder: data }, { status: 201 });
}
