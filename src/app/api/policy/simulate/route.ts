import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import {
  validatePolicyRegistry,
  getApprovalSlaFallbackHours,
  analyzePolicyRegistry,
} from "@/lib/contract-operations/policy-registry";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/policy/simulate";

/**
 * Preview-only: evaluates a draft registry against a contract (counts only, no writes).
 */
export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/policy/simulate",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.policy.simulate",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/policy/simulate",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    contractId?: string;
    registryDraft?: unknown;
  };
  const contractId = String(body.contractId ?? "").trim();
  if (!contractId) {
    return jsonProblem(400, {
      error: "contractId is required",
      code: "contract_id_required",
      diagnostic_id: "policy_simulate_contract_id_required",
      route: ROUTE,
    });
  }

  const { data: contract } = await ctx.admin
    .from("contracts")
    .select("id, organization_id, title")
    .eq("id", contractId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!contract) return jsonNotFound(ROUTE);

  let draft = body.registryDraft;
  if (draft === undefined) {
    const { data: settings } = await ctx.admin
      .from("organization_workflow_settings")
      .select("v4_policy_registry_json")
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    draft = settings?.v4_policy_registry_json ?? [];
  }

  const validation = validatePolicyRegistry(draft);
  if (!validation.ok) {
    return jsonProblem(400, {
      error: validation.error,
      code: "policy_registry_invalid",
      diagnostic_id: "policy_simulate_registry_invalid",
      route: ROUTE,
      details: { simulation: null, warnings: [] },
    });
  }

  const warnings = analyzePolicyRegistry(draft);

  const missingCritical = await getContractsMissingCriticalFields(ctx.admin, ctx.orgId);
  const contractMissingCritical = missingCritical.some((c) => c.id === contractId);

  const slaFallbackHours = getApprovalSlaFallbackHours(draft);

  return NextResponse.json({
    warnings,
    simulation: {
      contract_id: contractId,
      contract_title: contract.title,
      registry_entry_count: Array.isArray(draft) ? draft.length : 0,
      approval_sla_fallback_hours: slaFallbackHours,
      contract_missing_critical_dates: contractMissingCritical,
      note: "No database writes performed.",
    },
  });
}
