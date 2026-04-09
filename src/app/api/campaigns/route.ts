import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { parseCampaignAssignmentJson } from "@/lib/v5/campaign-assignment";
import { syncCampaignContractsFromEligibility } from "@/lib/v5/campaign-eligibility";
import {
  campaignTypeValidationError,
  isValidCampaignType,
} from "@/lib/v5/campaign-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function GET() {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .select("id, name, campaign_type, status, owner_user_id, preview_summary_json, progress_summary_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{
    name?: string;
    campaignType?: string;
    eligibility?: Record<string, unknown>;
    assignment?: unknown;
    contractIds?: string[];
    seedFromEligibility?: boolean;
  }>(raw, {});
  const name = toSafeString(body.name);
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const rawCt = toSafeString(body.campaignType) || "policy_rollout";
  if (!isValidCampaignType(rawCt)) {
    return NextResponse.json({ error: campaignTypeValidationError() }, { status: 400 });
  }

  const assignParsed = parseCampaignAssignmentJson(body.assignment);
  if (!assignParsed.ok) {
    return NextResponse.json({ error: assignParsed.error }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .insert({
      organization_id: ctx.orgId,
      name,
      campaign_type: rawCt,
      status: "draft",
      owner_user_id: ctx.userId,
      eligibility_json: body.eligibility ?? {},
      assignment_json: assignParsed.value,
      created_by: ctx.userId,
    })
    .select("id, name, campaign_type, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const contractIds = Array.isArray(body.contractIds) ? body.contractIds : [];
  if (contractIds.length > 0) {
    await ctx.admin.from("portfolio_campaign_contracts").insert(
      contractIds.map((contractId) => ({
        organization_id: ctx.orgId,
        campaign_id: data.id,
        contract_id: contractId,
        status: "pending",
      }))
    );
  }

  let fromEligibility = 0;
  if (body.seedFromEligibility !== false) {
    const elig = (body.eligibility ?? {}) as Record<string, unknown>;
    const { inserted } = await syncCampaignContractsFromEligibility(
      ctx.admin,
      ctx.orgId,
      data.id,
      elig,
      assignParsed.value
    );
    fromEligibility = inserted;
  }

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: data.id,
    event_type: "campaign.created",
    payload_json: {
      seeded_contract_count: contractIds.length,
      eligibility_contract_count: fromEligibility,
    },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ campaign: data }, { status: 201 });
}

