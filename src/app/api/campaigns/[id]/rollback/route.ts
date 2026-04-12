import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { CAMPAIGN_TASK_MARKER } from "@/lib/v5/campaign-eligibility";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

/**
 * Best-effort rollback: pause campaign, clear program-assignment campaign tags,
 * remove seeded campaign tasks (marker in details), record audit event.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]/rollback",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: campaign } = await ctx.admin
    .from("portfolio_campaigns")
    .select("id, status, rolled_back_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.rolled_back_at) {
    return NextResponse.json({ error: "Campaign was already rolled back" }, { status: 409 });
  }

  const marker = CAMPAIGN_TASK_MARKER(id);
  const { data: tasks } = await ctx.admin
    .from("contract_tasks")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .like("details", `%${marker}%`)
    .limit(2000);

  let tasksRemoved = 0;
  for (const t of tasks ?? []) {
    const { error: delErr } = await ctx.admin.from("contract_tasks").delete().eq("id", t.id);
    if (!delErr) tasksRemoved += 1;
  }

  await ctx.admin
    .from("contract_program_assignments")
    .update({ v5_campaign_id: null })
    .eq("organization_id", ctx.orgId)
    .eq("v5_campaign_id", id);

  await ctx.admin
    .from("portfolio_campaign_contracts")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", id)
    .in("status", ["in_progress"]);

  const rolledAt = new Date().toISOString();
  const { data: updated, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update({
      status: "paused",
      rolled_back_at: rolledAt,
      rollback_safe: false,
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, rolled_back_at, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.rolled_back",
    payload_json: { tasks_removed: tasksRemoved, rolled_back_at: rolledAt },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ campaign: updated, tasksRemoved });
}
