import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import {
  parseCampaignAssignmentJson,
} from "@/lib/v5/campaign-assignment";
import {
  campaignTypeValidationError,
  isValidCampaignType,
} from "@/lib/v5/campaign-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/campaigns/[id]";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]");

  if (routeParamRejection) return routeParamRejection;
  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .select(
      "id, name, campaign_type, status, owner_user_id, eligibility_json, assignment_json, preview_summary_json, progress_summary_json, rollback_safe, rolled_back_at, updated_at"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "campaign_lookup_failed",
      diagnostic_id: "campaign_lookup_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);

  const [{ data: contracts }, { data: events }] = await Promise.all([
    ctx.admin
      .from("portfolio_campaign_contracts")
      .select("id, contract_id, status, status_reason, segment_key, assigned_team, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .order("updated_at", { ascending: false })
      .limit(500),
    ctx.admin
      .from("portfolio_campaign_events")
      .select("id, event_type, payload_json, actor_user_id, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    campaign: data,
    contracts: contracts ?? [],
    events: events ?? [],
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    apiPath: "/api/campaigns/[id]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.campaigns.id",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/campaigns/[id]",
    method: "PATCH",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    name?: string;
    campaignType?: string;
    assignmentJson?: unknown;
    eligibilityJson?: unknown;
  }>(raw, {});
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = toSafeString(body.name);
    if (!n) {
      return jsonProblem(400, {
        error: "name cannot be empty",
        code: "name_required",
        diagnostic_id: "campaign_name_required",
        route: ROUTE,
      });
    }
    patch.name = n;
  }
  if (body.campaignType !== undefined) {
    const ct = toSafeString(body.campaignType);
    if (!ct || !isValidCampaignType(ct)) {
      return jsonProblem(400, {
        error: campaignTypeValidationError(),
        code: "invalid_campaign_type",
        diagnostic_id: "campaign_type_invalid",
        route: ROUTE,
      });
    }
    patch.campaign_type = ct;
  }
  if (body.assignmentJson !== undefined) {
    const parsed = parseCampaignAssignmentJson(body.assignmentJson);
    if (!parsed.ok) {
      return jsonProblem(400, {
        error: parsed.error,
        code: "invalid_assignment_json",
        diagnostic_id: "campaign_assignment_json_invalid",
        route: ROUTE,
      });
    }
    patch.assignment_json = parsed.value;
  }
  if (body.eligibilityJson !== undefined) {
    if (
      body.eligibilityJson === null ||
      typeof body.eligibilityJson !== "object" ||
      Array.isArray(body.eligibilityJson)
    ) {
      return jsonProblem(400, {
        error: "eligibilityJson must be a JSON object",
        code: "invalid_eligibility_json",
        diagnostic_id: "campaign_eligibility_json_invalid",
        route: ROUTE,
      });
    }
    patch.eligibility_json = body.eligibilityJson;
  }
  if (Object.keys(patch).length === 0) {
    return jsonProblem(400, {
      error: "No valid fields to update",
      code: "no_valid_fields",
      diagnostic_id: "campaign_no_valid_fields",
      route: ROUTE,
    });
  }

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "campaign",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]");

  if (routeParamRejection) return routeParamRejection;
  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .eq("updated_at", expectedVersionResult.expectedVersion)
    .select("id, name, campaign_type, status, eligibility_json, assignment_json, updated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "campaign_update_failed",
      diagnostic_id: "campaign_update_failed",
      route: ROUTE,
    });
  }
  if (!data) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "campaign",
    });
  }

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.updated",
    payload_json: { fields: Object.keys(patch) },
    actor_user_id: ctx.userId,
  });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_campaign_total", 1).catch(() => undefined);

  return NextResponse.json({ campaign: data });
}
