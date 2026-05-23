import type { PostgrestError } from "@supabase/supabase-js";
import { nowIso } from "@/lib/v5/api";
import { createAdminClient } from "@/lib/supabase/server";
import { runModularAssuranceChecks } from "@/lib/v6/assurance-checks";
import { recomputeScorecards as recomputeScorecardsEngine } from "@/lib/v6/scorecards";

export type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

/** Narrow insert/update return payloads — aligned to Supabase table definitions (see migrations 039, 044, 049). */
const STD = "id,organization_id,created_at,updated_at";
const NO_UPDATED_AT = "id,organization_id,created_at";
const ORG_GENERATED_AT = "id,organization_id,generated_at";

const V6_INSERT_RETURN_COLUMNS: Record<string, string> = {
  assurance_findings: STD,
  adaptive_playbook_runs: STD,
  adaptive_playbooks: STD,
  assurance_check_runs: NO_UPDATED_AT,
  autopilot_run_logs: NO_UPDATED_AT,
  autopilot_rules: STD,
  control_policy_versions: NO_UPDATED_AT,
  control_policy_assignments: NO_UPDATED_AT,
  operational_recommendations: ORG_GENERATED_AT,
  program_evolution_results: NO_UPDATED_AT,
  program_evolution_experiments: STD,
  outcome_intervention_analyses: NO_UPDATED_AT,
  change_simulation_runs: NO_UPDATED_AT,
  change_simulations: STD,
  exceptions: STD,
  decision_workspaces: STD,
  portfolio_campaigns: STD,
  external_action_links: STD,
  contract_tasks: STD,
  report_packs: STD,
  review_boards: STD,
  review_board_runs: STD,
  segment_definitions: STD,
  control_policies: STD,
  evidence_requirements: STD,
};

export function insertReturnColumnsForTable(table: string): string {
  return V6_INSERT_RETURN_COLUMNS[table] ?? "*";
}

export async function listRows(admin: AdminClient, table: string, orgId: string, columns = "*") {
  const { data, error } = await admin
    .from(table)
    .select(columns)
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  return { data: data ?? [], error };
}

export async function createRow(
  admin: AdminClient,
  table: string,
  orgId: string,
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: PostgrestError | null }> {
  const { data, error } = await admin
    .from(table)
    .insert({ organization_id: orgId, ...payload })
    .select(insertReturnColumnsForTable(table))
    .single();
  return { data: (data ?? null) as Record<string, unknown> | null, error };
}

export async function updateRowById(
  admin: AdminClient,
  table: string,
  orgId: string,
  id: string,
  payload: Record<string, unknown>,
  options?: { expectedUpdatedAt?: string | number | null },
): Promise<{ data: Record<string, unknown> | null; error: PostgrestError | null }> {
  let query = admin
    .from(table)
    .update(payload)
    .eq("organization_id", orgId)
    .eq("id", id);
  if (options?.expectedUpdatedAt !== undefined && options.expectedUpdatedAt !== null) {
    query = query.eq("updated_at", String(options.expectedUpdatedAt));
  }
  const { data, error } = await query.select(insertReturnColumnsForTable(table)).maybeSingle();
  return { data: (data ?? null) as Record<string, unknown> | null, error };
}

export async function createFindingEvent(
  admin: AdminClient,
  orgId: string,
  findingId: string,
  eventType: string,
  actorUserId: string,
  payloadJson: Record<string, unknown> = {}
) {
  const { error } = await admin.from("assurance_finding_events").insert({
    organization_id: orgId,
    finding_id: findingId,
    event_type: eventType,
    actor_user_id: actorUserId,
    payload_json: { ...payloadJson, at: nowIso() },
  });
  if (error) console.error("createFindingEvent insert failed:", error);
  return { error };
}

export async function runAssuranceChecks(admin: AdminClient, orgId: string, actorUserId: string | null) {
  const triggerType = actorUserId ? "manual" : "scheduled";
  const result = await runModularAssuranceChecks(admin, orgId, actorUserId, triggerType);
  const firstFinding = result.findings[0] ?? null;
  return {
    checkRun: result.checkRun,
    finding: firstFinding,
    findings: result.findings,
    metrics: result.metrics,
    policyResults: result.policyResults,
    errors: result.errors.filter(Boolean),
  };
}

export async function recomputeScorecards(admin: AdminClient, orgId: string) {
  return recomputeScorecardsEngine(admin, orgId);
}
