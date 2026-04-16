import type { AdminClient } from "@/lib/v6/service";
import { createRow } from "@/lib/v6/service";
import type { V6PortfolioMetrics } from "@/lib/v6/portfolio-metrics";

function stressScore(m: V6PortfolioMetrics): number {
  return (
    m.open_exceptions +
    m.open_exceptions_in_progress +
    m.approvals_past_due +
    m.contracts_without_owner +
    m.evidence_stale_proxy * 0.15 +
    m.repeat_exception_type_clusters * 4
  );
}

function effectivenessFromMetrics(before: V6PortfolioMetrics, after: V6PortfolioMetrics): number {
  const delta = stressScore(before) - stressScore(after);
  const recurrence =
    (before.repeat_exception_type_clusters ?? 0) - (after.repeat_exception_type_clusters ?? 0);
  return Math.max(0, Math.min(100, 58 + delta * 2.5 + recurrence * 5));
}

export async function recordPlaybookInterventionOutcome(
  admin: AdminClient,
  orgId: string,
  playbookRunId: string,
  before: V6PortfolioMetrics,
  after: V6PortfolioMetrics
) {
  const score = effectivenessFromMetrics(before, after);
  const recurrence_delta =
    (after.repeat_exception_type_clusters ?? 0) - (before.repeat_exception_type_clusters ?? 0);
  const falseEst =
    score < 35 ? { heuristic_false_positive_risk: "elevated", note: "Low effectiveness vs stress delta" } : { heuristic_false_positive_risk: "low" };

  let time_to_stability_hours: number | null = null;
  const { data: runRow, error: runRowErr } = await admin
    .from("adaptive_playbook_runs")
    .select("started_at, completed_at")
    .eq("organization_id", orgId)
    .eq("id", playbookRunId)
    .maybeSingle();
  if (runRowErr) console.error("autopilot_run fetch failed", runRowErr.message);
  const started = runRow && (runRow as { started_at?: string }).started_at;
  const completed = runRow && (runRow as { completed_at?: string }).completed_at;
  if (started && completed) {
    const ms = Date.parse(completed) - Date.parse(started);
    if (ms > 0) time_to_stability_hours = Number((ms / 3600000).toFixed(2));
  }

  return createRow(admin, "outcome_intervention_analyses", orgId, {
    intervention_type: "playbook_run",
    intervention_ref_id: playbookRunId,
    source_playbook_run_id: playbookRunId,
    before_metrics_json: before as unknown as Record<string, unknown>,
    after_metrics_json: after as unknown as Record<string, unknown>,
    effectiveness_score: score,
    recurrence_delta,
    time_to_stability_hours,
    workload_tradeoff_json: { stress_before: stressScore(before), stress_after: stressScore(after) },
    false_signal_rates_json: falseEst,
    recommendation_effectiveness_json: { driver: "portfolio_stress_composite" },
  });
}

export async function recordCampaignInterventionOutcome(
  admin: AdminClient,
  orgId: string,
  campaignId: string,
  before: V6PortfolioMetrics,
  after: V6PortfolioMetrics
) {
  const score = effectivenessFromMetrics(before, after);
  const recurrence_delta =
    (after.repeat_exception_type_clusters ?? 0) - (before.repeat_exception_type_clusters ?? 0);
  const falseEst =
    score < 35 ? { heuristic_false_positive_risk: "elevated", note: "Low effectiveness vs stress delta" } : { heuristic_false_positive_risk: "low" };
  return createRow(admin, "outcome_intervention_analyses", orgId, {
    intervention_type: "program_campaign",
    intervention_ref_id: campaignId,
    source_campaign_id: campaignId,
    before_metrics_json: before as unknown as Record<string, unknown>,
    after_metrics_json: after as unknown as Record<string, unknown>,
    effectiveness_score: score,
    recurrence_delta,
    workload_tradeoff_json: { stress_before: stressScore(before), stress_after: stressScore(after) },
    false_signal_rates_json: falseEst,
    recommendation_effectiveness_json: { driver: "portfolio_stress_composite" },
  });
}

export async function recordControlPolicyOutcome(
  admin: AdminClient,
  orgId: string,
  policyId: string,
  before: V6PortfolioMetrics,
  after: V6PortfolioMetrics
) {
  const score = effectivenessFromMetrics(before, after);
  const recurrence_delta =
    (after.repeat_exception_type_clusters ?? 0) - (before.repeat_exception_type_clusters ?? 0);
  const falseEst =
    score < 35 ? { heuristic_false_positive_risk: "elevated", note: "Low effectiveness vs stress delta" } : { heuristic_false_positive_risk: "low" };
  return createRow(admin, "outcome_intervention_analyses", orgId, {
    intervention_type: "control_policy_publish",
    intervention_ref_id: policyId,
    source_control_policy_id: policyId,
    before_metrics_json: before as unknown as Record<string, unknown>,
    after_metrics_json: after as unknown as Record<string, unknown>,
    effectiveness_score: score,
    recurrence_delta,
    workload_tradeoff_json: { stress_before: stressScore(before), stress_after: stressScore(after) },
    false_signal_rates_json: falseEst,
    recommendation_effectiveness_json: { driver: "portfolio_stress_composite" },
  });
}

/** Snapshot pass for cron: backfill analyses for completed playbook runs and sparse orgs. */
export async function backfillOutcomeSnapshots(admin: AdminClient, orgId: string) {
  const { gatherPortfolioMetrics } = await import("@/lib/v6/portfolio-metrics");
  let created = 0;

  const { data: runs } = await admin
    .from("adaptive_playbook_runs")
    .select("id, execution_input_json, completed_at")
    .eq("organization_id", orgId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(25);

  for (const run of runs ?? []) {
    const rid = String((run as { id: string }).id);
    const { data: existing } = await admin
      .from("outcome_intervention_analyses")
      .select("id")
      .eq("organization_id", orgId)
      .eq("source_playbook_run_id", rid)
      .maybeSingle();
    if (existing) continue;

    const input = (run as { execution_input_json?: Record<string, unknown> }).execution_input_json ?? {};
    const before = input.metrics_before_snapshot as V6PortfolioMetrics | undefined;
    if (!before) continue;

    const after = await gatherPortfolioMetrics(admin, orgId);
    const result = await recordPlaybookInterventionOutcome(admin, orgId, rid, before, after);
    if (!result.error) created += 1;
  }

  const { count } = await admin
    .from("outcome_intervention_analyses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  const n = count ?? 0;
  if (n >= 5) {
    return { analyzed: n, backfilled_runs: created };
  }

  const before = await gatherPortfolioMetrics(admin, orgId);
  const stress = stressScore(before);
  const effectiveness = Math.max(0, Math.min(100, 72 - Math.min(40, stress)));

  await createRow(admin, "outcome_intervention_analyses", orgId, {
    intervention_type: "portfolio_health_snapshot",
    intervention_ref_id: orgId,
    before_metrics_json: before as unknown as Record<string, unknown>,
    after_metrics_json: before as unknown as Record<string, unknown>,
    effectiveness_score: effectiveness,
    recurrence_delta: 0,
    workload_tradeoff_json: { source: "cron_backfill" },
    false_signal_rates_json: {},
    recommendation_effectiveness_json: {},
  });

  return { analyzed: n + 1, backfilled_runs: created };
}
