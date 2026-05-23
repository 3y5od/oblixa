import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/intelligence/recommendations/[id]";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
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
    apiPath: "/api/intelligence/recommendations/[id]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.intelligence.recommendations.id",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{ action?: string }>(raw, {});
  const action = toSafeString(body.action).toLowerCase();
  if (action !== "accept" && action !== "dismiss") {
    return jsonProblem(400, {
      error: "action must be accept or dismiss",
      code: "invalid_action",
      diagnostic_id: "recommendation_action_invalid",
      route: ROUTE,
    });
  }

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/intelligence/recommendations/[id]");

  if (routeParamRejection) return routeParamRejection;
  const { data: prior } = await ctx.admin
    .from("operational_recommendations")
    .select("accepted, dismissed")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();

  const patch =
    action === "accept"
      ? { accepted: true, dismissed: false }
      : { accepted: false, dismissed: true };

  const { data, error } = await ctx.admin
    .from("operational_recommendations")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, accepted, dismissed, recommendation_type, generated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "recommendation_update_failed",
      diagnostic_id: "recommendation_update_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);

  const alreadyInDesiredState =
    action === "accept" ? prior?.accepted === true : prior?.dismissed === true;

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    action: action === "accept" ? "v5.recommendation.accepted" : "v5.recommendation.dismissed",
    details: {
      recommendation_id: id,
      recommendation_type: data.recommendation_type,
      idempotent: true,
    },
  });

  if (!alreadyInDesiredState) {
    await incrementOrgV5SignalQuality({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      increments:
        action === "accept" ? { v5_recommendation_accepted: 1 } : { v5_recommendation_dismissed: 1 },
    });
  }

  return NextResponse.json({ recommendation: data });
}
