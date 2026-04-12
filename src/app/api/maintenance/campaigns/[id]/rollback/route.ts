import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

/**
 * Marks a campaign as rolled back for audit visibility. Row-level reversal
 * depends on campaign-specific before_json snapshots when populated by runners.
 */
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
    apiPath: "/api/maintenance/campaigns/[id]/rollback",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: campaign } = await ctx.admin
    .from("maintenance_campaigns")
    .select("id, status, summary_json")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const now = new Date().toISOString();
  const prevSummary = (campaign.summary_json as Record<string, unknown> | null) ?? {};
  await ctx.admin
    .from("maintenance_campaigns")
    .update({
      rolled_back_at: now,
      status: "canceled",
      summary_json: {
        ...prevSummary,
        rollback_marked_at: now,
        rollback_note: "Marked rolled back via API; verify data manually if before_json not populated.",
      },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  return NextResponse.json({ ok: true, rolled_back_at: now });
}
