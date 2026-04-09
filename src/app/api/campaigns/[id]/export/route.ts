import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  if (rows.length === 0) return "contract_id,status,segment_key,assigned_team\n";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  const { data: campaign } = await ctx.admin
    .from("portfolio_campaigns")
    .select("id, name, campaign_type, status, preview_summary_json, progress_summary_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const { data: contractRows, error } = await ctx.admin
    .from("portfolio_campaign_contracts")
    .select("contract_id, status, segment_key, assigned_team, status_reason, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = contractRows ?? [];
  if (format === "csv") {
    const csv = toCsv(
      rows.map((r) => ({
        contract_id: String(r.contract_id),
        status: r.status,
        segment_key: r.segment_key ?? "",
        assigned_team: r.assigned_team ?? "",
        status_reason: r.status_reason ?? "",
        updated_at: r.updated_at,
      }))
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campaign-${id}.csv"`,
      },
    });
  }

  return NextResponse.json({
    campaign,
    contracts: rows,
    exported_at: new Date().toISOString(),
  });
}
