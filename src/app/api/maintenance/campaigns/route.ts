import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    campaignType?: string;
    filter?: Record<string, unknown>;
    seedContractIds?: string[];
  };
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data: campaign, error } = await ctx.admin
    .from("maintenance_campaigns")
    .insert({
      organization_id: ctx.orgId,
      name,
      campaign_type: body.campaignType?.trim() || "data_remediation",
      status: "draft",
      filter_json: body.filter ?? {},
      created_by: ctx.userId,
    })
    .select("id, name, campaign_type, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const seedRows =
    Array.isArray(body.seedContractIds) && body.seedContractIds.length > 0
      ? body.seedContractIds.map((contractId) => ({
          organization_id: ctx.orgId,
          campaign_id: campaign.id,
          contract_id: contractId,
          status: "pending",
        }))
      : [];
  if (seedRows.length > 0) {
    await ctx.admin.from("maintenance_campaign_rows").insert(seedRows);
  }

  return NextResponse.json({ campaign }, { status: 201 });
}
