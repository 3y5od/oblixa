import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const [{ data: campaign }, { data: rows }] = await Promise.all([
    ctx.admin
      .from("maintenance_campaigns")
      .select("id, name, campaign_type, status, filter_json, summary_json, started_at, completed_at, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("id", id)
      .maybeSingle(),
    ctx.admin
      .from("maintenance_campaign_rows")
      .select("id, contract_id, row_key, status, error_message, processed_at")
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  return NextResponse.json({ campaign, rows: rows ?? [] });
}
