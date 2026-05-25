import { jsonForbidden, jsonNotFound, jsonOk, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { incrementOrgV5SignalQuality } from "@/lib/decision-intelligence/persist-signal-quality";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { gatherPortfolioMetrics, type V6PortfolioMetrics } from "@/lib/assurance/portfolio-metrics";
import { recordCampaignInterventionOutcome } from "@/lib/assurance/outcome-writers";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/campaigns/[id]/close";

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
    apiPath: "/api/campaigns/[id]/close",
  });
  if (modeGate) return modeGate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/campaigns/[id]/close",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]/close");

  if (routeParamRejection) return routeParamRejection;
  const { data: currentCamp } = await ctx.admin
    .from("portfolio_campaigns")
    .select("id, status, progress_summary_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!currentCamp) return jsonNotFound(ROUTE);
  if (currentCamp.status === "closed") {
    return jsonOk({ campaign: currentCamp });
  }
  if (!["active", "paused"].includes(currentCamp.status)) {
    return jsonProblem(409, {
      error: `Cannot close a campaign with status "${currentCamp.status}"`,
      code: "campaign_close_invalid_status",
      diagnostic_id: "campaign_close_invalid_status",
      route: ROUTE,
    });
  }

  const [{ count: pending }, { count: inProgress }, { count: processed }, { count: failed }] =
    await Promise.all([
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "pending"),
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "in_progress"),
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "processed"),
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "failed"),
    ]);

  const progress = {
    pending: pending ?? 0,
    in_progress: inProgress ?? 0,
    processed: processed ?? 0,
    failed: failed ?? 0,
    closed_at: new Date().toISOString(),
  };

  const { data: priorCamp } = await ctx.admin
    .from("portfolio_campaigns")
    .select("v6_effectiveness_json")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update({ status: "closed", progress_summary_json: progress })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .in("status", ["active", "paused"])
    .select("id, status, progress_summary_json, updated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "campaign_close_failed",
      diagnostic_id: "campaign_close_failed",
      route: ROUTE,
    });
  }
  if (!data) {
    const { data: latestCamp } = await ctx.admin
      .from("portfolio_campaigns")
      .select("id, status, progress_summary_json, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("id", id)
      .maybeSingle();
    if (latestCamp?.status === "closed") {
      return jsonOk({ campaign: latestCamp });
    }
    return jsonProblem(409, {
      error: "Campaign status changed before close",
      code: "campaign_close_stale_status",
      diagnostic_id: "campaign_close_stale_status",
      route: ROUTE,
    });
  }

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.closed",
    payload_json: progress,
    actor_user_id: ctx.userId,
  });

  await incrementOrgV5SignalQuality({
    admin: ctx.admin,
    organizationId: ctx.orgId,
    increments: { v5_campaigns_closed: 1 },
  });

  if (isFeatureEnabled("v6OutcomeIntelligence")) {
    const eff = priorCamp?.v6_effectiveness_json as Record<string, unknown> | undefined;
    const before = eff?.metrics_at_start as V6PortfolioMetrics | undefined;
    if (before && typeof before === "object") {
      const { data: existingOutcome } = await ctx.admin
        .from("outcome_intervention_analyses")
        .select("id")
        .eq("organization_id", ctx.orgId)
        .eq("source_campaign_id", id)
        .maybeSingle();
      if (!existingOutcome) {
        const after = await gatherPortfolioMetrics(ctx.admin, ctx.orgId);
        await recordCampaignInterventionOutcome(ctx.admin, ctx.orgId, id, before, after).catch(() => undefined);
      }
    }
  }

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_campaign_close_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  return jsonOk({ campaign: data });
}
