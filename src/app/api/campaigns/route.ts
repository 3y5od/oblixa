import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { parseCampaignAssignmentJson } from "@/lib/decision-intelligence/campaign-assignment";
import { syncCampaignContractsFromEligibility } from "@/lib/decision-intelligence/campaign-eligibility";
import {
  campaignTypeValidationError,
  isValidCampaignType,
} from "@/lib/decision-intelligence/campaign-types";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/campaigns";

export async function GET() {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .select("id, name, campaign_type, status, owner_user_id, preview_summary_json, progress_summary_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[api/campaigns] GET error:", error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "campaigns_list_failed",
      diagnostic_id: "campaigns_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.campaigns",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/campaigns",
    method: "POST",
  }).catch(() => undefined);
  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    name?: string;
    campaignType?: string;
    eligibility?: Record<string, unknown>;
    assignment?: unknown;
    contractIds?: string[];
    seedFromEligibility?: boolean;
  }>(raw, {});
  const name = toSafeString(body.name);
  if (!name) {
    return jsonProblem(400, {
      error: "name is required",
      code: "name_required",
      diagnostic_id: "campaign_name_required",
      route: ROUTE,
    });
  }
  const rawCt = toSafeString(body.campaignType) || "policy_rollout";
  if (!isValidCampaignType(rawCt)) {
    return jsonProblem(400, {
      error: campaignTypeValidationError(),
      code: "invalid_campaign_type",
      diagnostic_id: "campaign_type_invalid",
      route: ROUTE,
    });
  }

  const assignParsed = parseCampaignAssignmentJson(body.assignment);
  if (!assignParsed.ok) {
    return jsonProblem(400, {
      error: assignParsed.error,
      code: "invalid_campaign_assignment",
      diagnostic_id: "campaign_assignment_invalid",
      route: ROUTE,
    });
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
  if (error) {
    console.error("[api/campaigns] POST error:", error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "campaign_create_failed",
      diagnostic_id: "campaign_create_failed",
      route: ROUTE,
    });
  }

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

