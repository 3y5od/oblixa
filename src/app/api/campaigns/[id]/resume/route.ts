import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/campaigns/[id]/resume";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]/resume",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.campaigns.id.resume",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/campaigns/[id]/resume",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]/resume");

  if (routeParamRejection) return routeParamRejection;
  const { data: current } = await ctx.admin
    .from("portfolio_campaigns")
    .select("status")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!current) return jsonNotFound(ROUTE);
  if (current.status !== "paused") {
    return jsonProblem(409, {
      error: `Cannot resume a campaign with status "${current.status}"; only paused campaigns can be resumed`,
      code: "campaign_resume_invalid_status",
      diagnostic_id: "campaign_resume_invalid_status",
      route: ROUTE,
    });
  }

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update({ status: "active" })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "campaign_resume_failed",
      diagnostic_id: "campaign_resume_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.resumed",
    payload_json: {},
    actor_user_id: ctx.userId,
  });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_campaign_resume_total", 1).catch(() => undefined);

  return NextResponse.json({ campaign: data });
}

