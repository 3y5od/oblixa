import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { analyzePolicyRegistry, validatePolicyRegistry } from "@/lib/contract-operations/policy-registry";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { buildSimulationTypeSpecificSignals } from "@/lib/decision-intelligence/simulation-type-metrics";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import {
  SIMULATION_TYPE_FOCUS,
  isValidSimulationType,
  simulationTypeValidationError,
} from "@/lib/decision-intelligence/simulation-types";

const ROUTE = "/api/simulations/run";

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
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
    apiPath: "/api/simulations/run",
  });
  if (modeGate) return modeGate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/simulations/run",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    simulationType?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>(raw, {});

  const rawSim = toSafeString(body.simulationType) || "campaign_eligibility_impact";
  if (!isValidSimulationType(rawSim)) {
    return jsonProblem(400, {
      error: simulationTypeValidationError(),
      code: "invalid_simulation_type",
      diagnostic_id: "simulation_type_invalid",
      route: ROUTE,
    });
  }
  const simulationType = rawSim;
  const name = toSafeString(body.name) || `Simulation ${new Date().toISOString().slice(0, 10)}`;
  const input = body.input ?? {};

  let contractQuery = ctx.admin
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId);
  if (typeof input["contractStatus"] === "string" && input["contractStatus"]) {
    contractQuery = contractQuery.eq("status", input["contractStatus"] as string);
  }
  if (typeof input["accountKey"] === "string" && input["accountKey"]) {
    contractQuery = contractQuery.eq("account_key", input["accountKey"] as string);
  }
  if (typeof input["counterpartyKey"] === "string" && input["counterpartyKey"]) {
    contractQuery = contractQuery.eq("counterparty_key", input["counterpartyKey"] as string);
  }
  const { count: affectedCount } = await contractQuery;

  let sampleQ = ctx.admin.from("contracts").select("id").eq("organization_id", ctx.orgId).limit(12);
  if (typeof input["contractStatus"] === "string" && input["contractStatus"]) {
    sampleQ = sampleQ.eq("status", input["contractStatus"] as string);
  }
  if (typeof input["accountKey"] === "string" && input["accountKey"]) {
    sampleQ = sampleQ.eq("account_key", input["accountKey"] as string);
  }
  if (typeof input["counterpartyKey"] === "string" && input["counterpartyKey"]) {
    sampleQ = sampleQ.eq("counterparty_key", input["counterpartyKey"] as string);
  }
  const { data: samples } = await sampleQ;
  const sampleContractIds = (samples ?? []).map((r) => String(r.id));

  const { data: simulation, error: simulationError } = await ctx.admin
    .from("change_simulations")
    .insert({
      organization_id: ctx.orgId,
      simulation_type: simulationType,
      name,
      input_json: input,
      created_by: ctx.userId,
    })
    .select("id, simulation_type, name")
    .single();
  if (simulationError) {
    return jsonProblem(400, {
      error: simulationError.message,
      code: "simulation_create_failed",
      diagnostic_id: "simulation_create_failed",
      route: ROUTE,
    });
  }

  const portfolioAffected = affectedCount ?? 0;
  const manualOverride = Number(input["affectedContracts"]);
  const affected_contracts =
    Number.isFinite(manualOverride) && manualOverride > 0 ? manualOverride : portfolioAffected;

  const manualTasks = Number(input["generatedTasks"]);
  const manualApprovals = Number(input["generatedApprovals"]);
  const manualBacklog = Number(input["likelyBacklog"]);
  const estimatedTasks =
    Number.isFinite(manualTasks) && manualTasks > 0
      ? manualTasks
      : Math.min(affected_contracts * 2, 5000);
  const estimatedApprovals =
    Number.isFinite(manualApprovals) && manualApprovals > 0
      ? manualApprovals
      : Math.min(Math.ceil(affected_contracts / 4), 500);
  const likely_backlog =
    Number.isFinite(manualBacklog) && manualBacklog > 0
      ? manualBacklog
      : Math.min(estimatedTasks + estimatedApprovals, 8000);

  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { count: obligationsDueWeek } = await ctx.admin
    .from("contract_obligations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .in("status", ["open", "in_progress"])
    .lte("due_date", weekAhead);

  const { data: settings } = await ctx.admin
    .from("organization_workflow_settings")
    .select("v4_policy_registry_json")
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  const draft = settings?.v4_policy_registry_json;
  const prValid = validatePolicyRegistry(draft);
  const policyWarnings = prValid.ok ? analyzePolicyRegistry(draft) : [];

  const typeSpecificSignals = await buildSimulationTypeSpecificSignals(
    ctx.admin,
    ctx.orgId,
    simulationType,
    sampleContractIds
  );

  const metric_matrix = {
    simulation_kind: simulationType,
    simulation_focus: SIMULATION_TYPE_FOCUS[simulationType],
    affected_contracts,
    segment_sample_contract_ids: sampleContractIds,
    estimated_load: {
      generated_tasks: estimatedTasks,
      generated_approvals: estimatedApprovals,
      likely_backlog_units: likely_backlog,
    },
    execution_signals: {
      obligations_window_days: 7,
      open_obligations_due_within_window: obligationsDueWeek ?? 0,
      policy_registry_valid: prValid.ok,
      policy_registry_warning_count: policyWarnings.length,
    },
    type_specific_signals: typeSpecificSignals,
  };

  const result = {
    affected_contracts,
    sample_contract_ids: sampleContractIds,
    generated_tasks: estimatedTasks,
    generated_approvals: estimatedApprovals,
    likely_backlog,
    open_obligations_due_within_7d: obligationsDueWeek ?? 0,
    policy_registry_warning_count: policyWarnings.length,
    policy_registry_valid: prValid.ok,
    metric_matrix,
    notes:
      "Estimates derive from matched contracts (status/accountKey/counterpartyKey filters) with optional numeric overrides in input. Obligation and policy-registry figures are org-wide execution signals.",
  };

  const { data: run, error: runError } = await ctx.admin
    .from("change_simulation_runs")
    .insert({
      organization_id: ctx.orgId,
      simulation_id: simulation.id,
      status: "completed",
      result_json: result,
      created_by: ctx.userId,
    })
    .select("id, status, result_json, created_at")
    .single();
  if (runError) {
    return jsonProblem(400, {
      error: runError.message,
      code: "simulation_run_create_failed",
      diagnostic_id: "simulation_run_create_failed",
      route: ROUTE,
    });
  }

  await ctx.admin
    .from("change_simulations")
    .update({ latest_run_id: run.id })
    .eq("organization_id", ctx.orgId)
    .eq("id", simulation.id);

  return NextResponse.json({ simulationId: simulation.id, run }, { status: 201 });
}

