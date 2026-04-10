import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { nowIso } from "@/lib/v5/api";
import { parseCampaignAssignmentJson } from "@/lib/v5/campaign-assignment";
import {
  countContractsMatchingEligibility,
  syncCampaignContractsFromEligibility,
} from "@/lib/v5/campaign-eligibility";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: campaignRow } = await ctx.admin
    .from("portfolio_campaigns")
    .select("eligibility_json, assignment_json")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  const elig = campaignRow?.eligibility_json;
  const assignParsed = parseCampaignAssignmentJson(campaignRow?.assignment_json);
  if (!assignParsed.ok) {
    return NextResponse.json({ error: assignParsed.error }, { status: 400 });
  }
  let eligibilityMatchCount = 0;
  if (elig && typeof elig === "object" && !Array.isArray(elig)) {
    const e = elig as Record<string, unknown>;
    eligibilityMatchCount = await countContractsMatchingEligibility(ctx.admin, ctx.orgId, e);
    await syncCampaignContractsFromEligibility(
      ctx.admin,
      ctx.orgId,
      id,
      e,
      assignParsed.value
    );
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

  const preview = {
    pending: pending ?? 0,
    in_progress: inProgress ?? 0,
    processed: processed ?? 0,
    failed: failed ?? 0,
    eligibility_match_count: eligibilityMatchCount,
    previewed_at: nowIso(),
  };

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update({ status: "previewed", preview_summary_json: preview })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, preview_summary_json, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.previewed",
    payload_json: preview,
    actor_user_id: ctx.userId,
  });

  // Preview mutates campaign + portfolio_campaign_contracts membership; refresh assurance signals.
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_campaign_preview_total", 1).catch(() => undefined);

  return NextResponse.json({ campaign: data, preview });
}

