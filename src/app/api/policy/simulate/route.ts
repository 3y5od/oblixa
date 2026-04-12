import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import {
  validatePolicyRegistry,
  getApprovalSlaFallbackHours,
  analyzePolicyRegistry,
} from "@/lib/v4/policy-registry";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

/**
 * Preview-only: evaluates a draft registry against a contract (counts only, no writes).
 */
export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/policy/simulate",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    contractId?: string;
    registryDraft?: unknown;
  };
  const contractId = String(body.contractId ?? "").trim();
  if (!contractId) return NextResponse.json({ error: "contractId is required" }, { status: 400 });

  const { data: contract } = await ctx.admin
    .from("contracts")
    .select("id, organization_id, title")
    .eq("id", contractId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

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
    return NextResponse.json({ error: validation.error, simulation: null, warnings: [] }, { status: 400 });
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
