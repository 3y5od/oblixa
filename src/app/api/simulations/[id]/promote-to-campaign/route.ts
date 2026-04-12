import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { toSafeString } from "@/lib/v5/api";
import {
  campaignTypeValidationError,
  isValidCampaignType,
} from "@/lib/v5/campaign-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const simOff = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (simOff) return simOff;
  const campOff = requireV5ApiFeature("v5PortfolioCampaigns");
  if (campOff) return campOff;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/simulations/[id]/promote-to-campaign",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { campaignName?: string; campaignType?: string };
  const campaignName = toSafeString(body.campaignName) || `Campaign from simulation ${id.slice(0, 8)}`;
  const rawCampaignType = toSafeString(body.campaignType) || "policy_rollout";
  if (!isValidCampaignType(rawCampaignType)) {
    return NextResponse.json({ error: campaignTypeValidationError() }, { status: 400 });
  }
  const campaignType = rawCampaignType;

  const { data: simRow } = await ctx.admin
    .from("change_simulations")
    .select("input_json")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  const input = (simRow?.input_json ?? {}) as Record<string, unknown>;
  const eligibilityJson: Record<string, unknown> = {
    source: "simulation",
    simulation_id: id,
  };
  if (typeof input.contractStatus === "string" && input.contractStatus) {
    eligibilityJson.status = input.contractStatus;
  }
  if (typeof input.accountKey === "string" && input.accountKey) {
    eligibilityJson.accountKey = input.accountKey;
  }
  if (typeof input.counterpartyKey === "string" && input.counterpartyKey) {
    eligibilityJson.counterpartyKey = input.counterpartyKey;
  }
  if (typeof input.programId === "string" && input.programId) {
    eligibilityJson.programId = input.programId;
  }
  if (typeof input.ownerId === "string" && input.ownerId) {
    eligibilityJson.ownerId = input.ownerId;
  }

  const { data: campaign, error: campaignError } = await ctx.admin
    .from("portfolio_campaigns")
    .insert({
      organization_id: ctx.orgId,
      name: campaignName,
      campaign_type: campaignType,
      status: "draft",
      owner_user_id: ctx.userId,
      created_by: ctx.userId,
      eligibility_json: eligibilityJson,
    })
    .select("id, name, campaign_type, status, created_at")
    .single();
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 400 });

  const { data: latestRun } = await ctx.admin
    .from("change_simulation_runs")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("simulation_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRun?.id) {
    await ctx.admin
      .from("change_simulation_runs")
      .update({ promoted_campaign_id: campaign.id })
      .eq("organization_id", ctx.orgId)
      .eq("id", latestRun.id);
  }

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: campaign.id,
    event_type: "campaign.promoted_from_simulation",
    payload_json: {
      simulation_id: id,
      simulation_run_id: latestRun?.id ?? null,
    },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ campaign, simulationId: id, simulationRunId: latestRun?.id ?? null }, { status: 201 });
}

