import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { toSafeString } from "@/lib/v5/api";
import {
  campaignTypeValidationError,
  isValidCampaignType,
} from "@/lib/v5/campaign-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/simulations/[id]/promote-to-campaign";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const simOff = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (simOff) return simOff;
  const campOff = requireV5ApiFeature("v5PortfolioCampaigns");
  if (campOff) return campOff;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/simulations/[id]/promote-to-campaign",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.simulations.id.promote-to-campaign",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/simulations/[id]/promote-to-campaign",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as { campaignName?: string; campaignType?: string };
  const { id } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/simulations/[id]/promote-to-campaign");
  if (routeParamRejection) return routeParamRejection;
  const campaignName = toSafeString(body.campaignName) || `Campaign from simulation ${id.slice(0, 8)}`;
  const rawCampaignType = toSafeString(body.campaignType) || "policy_rollout";
  if (!isValidCampaignType(rawCampaignType)) {
    return jsonProblem(400, {
      error: campaignTypeValidationError(),
      code: "invalid_campaign_type",
      diagnostic_id: "simulation_promotion_campaign_type_invalid",
      route: ROUTE,
    });
  }
  const campaignType = rawCampaignType;

  const { data: simRow } = await ctx.admin
    .from("change_simulations")
    .select("input_json")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!simRow) return jsonNotFound(ROUTE);
  const input = (simRow.input_json ?? {}) as Record<string, unknown>;
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
  if (campaignError) {
    return jsonProblem(400, {
      error: campaignError.message,
      code: "simulation_promotion_failed",
      diagnostic_id: "simulation_promotion_failed",
      route: ROUTE,
    });
  }

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

