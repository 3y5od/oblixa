import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function GET(
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
    apiPath: "/api/maintenance/campaigns/[id]/preview",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: campaign } = await ctx.admin
    .from("maintenance_campaigns")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const [{ count: pending }, { count: processed }, { count: failed }] = await Promise.all([
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "pending"),
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "processed"),
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .eq("status", "failed"),
  ]);

  const summary = {
    pending_rows: pending ?? 0,
    processed_rows: processed ?? 0,
    failed_rows: failed ?? 0,
    previewed_at: new Date().toISOString(),
  };

  await ctx.admin
    .from("maintenance_campaigns")
    .update({
      preview_summary_json: summary,
      last_preview_at: new Date().toISOString(),
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  return NextResponse.json({ preview: summary });
}
