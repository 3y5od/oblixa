import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/maintenance/campaigns";

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/maintenance/campaigns",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.maintenance.campaigns",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/maintenance/campaigns",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    name?: string;
    campaignType?: string;
    filter?: Record<string, unknown>;
    seedContractIds?: string[];
  };
  const name = String(body.name ?? "").trim();
  if (!name) {
    return jsonProblem(400, {
      error: "name is required",
      code: "name_required",
      diagnostic_id: "maintenance_campaign_name_required",
      route: ROUTE,
    });
  }

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
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "maintenance_campaign_create_failed",
      diagnostic_id: "maintenance_campaign_create_failed",
      route: ROUTE,
    });
  }

  let validSeedIds: string[] = [];
  if (Array.isArray(body.seedContractIds) && body.seedContractIds.length > 0) {
    const { data: validContracts } = await ctx.admin
      .from("contracts")
      .select("id")
      .in("id", body.seedContractIds)
      .eq("organization_id", ctx.orgId);
    validSeedIds = (validContracts ?? []).map((c) => c.id);
  }
  if (validSeedIds.length > 0) {
    const seedRows = validSeedIds.map((contractId) => ({
      organization_id: ctx.orgId,
      campaign_id: campaign.id,
      contract_id: contractId,
      status: "pending",
    }));
    await ctx.admin.from("maintenance_campaign_rows").insert(seedRows);
  }

  return NextResponse.json({ campaign }, { status: 201 });
}
