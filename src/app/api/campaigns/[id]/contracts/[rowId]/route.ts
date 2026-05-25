import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/campaigns/[id]/contracts/[rowId]";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
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
    apiPath: "/api/campaigns/[id]/contracts/[rowId]",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.campaigns.id.contracts.rowId",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/campaigns/[id]/contracts/[rowId]",
    method: "PATCH",
  }).catch(() => undefined);

  const { id: campaignId, rowId } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id: campaignId, rowId }, ["id", "rowId"], "/api/campaigns/[id]/contracts/[rowId]");

  if (routeParamRejection) return routeParamRejection;
  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
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
    return jsonProblem(400, {
      error: "No valid fields to update",
      code: "no_valid_fields",
      diagnostic_id: "campaign_contract_row_no_valid_fields",
      route: ROUTE,
    });
  }

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "campaign_contract_row",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  patch.updated_at = new Date().toISOString();

  const { data: row, error } = await ctx.admin
    .from("portfolio_campaign_contracts")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", campaignId)
    .eq("id", rowId)
    .eq("updated_at", expectedVersionResult.expectedVersion)
    .select("id, contract_id, status, segment_key, assigned_team, updated_at")
    .maybeSingle();

  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "campaign_contract_row_update_failed",
      diagnostic_id: "campaign_contract_row_update_failed",
      route: ROUTE,
    });
  }
  if (!row) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "campaign_contract_row",
    });
  }

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: campaignId,
    event_type: "campaign.contract_row_updated",
    payload_json: { row_id: rowId, fields: Object.keys(patch).filter((k) => k !== "updated_at") },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ row });
}
