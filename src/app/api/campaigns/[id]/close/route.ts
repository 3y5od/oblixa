import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { gatherPortfolioMetrics, type V6PortfolioMetrics } from "@/lib/v6/portfolio-metrics";
import { recordCampaignInterventionOutcome } from "@/lib/v6/outcome-writers";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]/close",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
    .select("id, status, progress_summary_json, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

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

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_campaign_close_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  return NextResponse.json({ campaign: data });
}

