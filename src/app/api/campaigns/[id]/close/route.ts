import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

  return NextResponse.json({ campaign: data });
}

