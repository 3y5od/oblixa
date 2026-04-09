import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
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

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update({ status: "paused" })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.paused",
    payload_json: {},
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ campaign: data });
}

