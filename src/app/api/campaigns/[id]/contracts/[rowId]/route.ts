import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id: campaignId, rowId } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]/contracts/[rowId]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{
    segmentKey?: string | null;
    assignedTeam?: string | null;
  }>(raw, {});

  const patch: Record<string, unknown> = {};
  if (body.segmentKey !== undefined) {
    if (body.segmentKey === null || body.segmentKey === "") {
      patch.segment_key = null;
    } else {
      patch.segment_key = toSafeString(body.segmentKey);
    }
  }
  if (body.assignedTeam !== undefined) {
    if (body.assignedTeam === null || body.assignedTeam === "") {
      patch.assigned_team = null;
    } else {
      patch.assigned_team = toSafeString(body.assignedTeam);
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { data: row, error } = await ctx.admin
    .from("portfolio_campaign_contracts")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", campaignId)
    .eq("id", rowId)
    .select("id, contract_id, status, segment_key, assigned_team, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!row) return NextResponse.json({ error: "Campaign contract row not found" }, { status: 404 });

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: campaignId,
    event_type: "campaign.contract_row_updated",
    payload_json: { row_id: rowId, fields: Object.keys(patch).filter((k) => k !== "updated_at") },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ row });
}
