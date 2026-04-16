import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/maintenance/campaigns/[id]/run",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: campaign } = await ctx.admin
    .from("maintenance_campaigns")
    .select("id, status")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  await ctx.admin
    .from("maintenance_campaigns")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  const { data: rows } = await ctx.admin
    .from("maintenance_campaign_rows")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", id)
    .eq("status", "pending")
    .limit(1000);

  if ((rows?.length ?? 0) > 0) {
    await ctx.admin
      .from("maintenance_campaign_rows")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "pending");
  }

  const { count: processedCount } = await ctx.admin
    .from("maintenance_campaign_rows")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", id)
    .eq("status", "processed");

  const actualProcessed = processedCount ?? 0;

  await ctx.admin
    .from("maintenance_campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary_json: { processed: actualProcessed },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  return NextResponse.json({ ok: true, processed: actualProcessed });
}
