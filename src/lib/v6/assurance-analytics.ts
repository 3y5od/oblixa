import type { AdminClient } from "@/lib/v6/service";
import { evaluatePublishedControlPolicies } from "@/lib/v6/policy-evaluator";
import { gatherPortfolioMetrics } from "@/lib/v6/portfolio-metrics";

export type AssuranceAnalyticsSummary = {
  generated_at: string;
  open_findings_by_severity: Record<string, number>;
  open_findings_by_type: Record<string, number>;
  policy_pass_rate: number;
  policy_evaluation_units: number;
  playbook_runs_last_30d: {
    completed: number;
    failed: number;
    awaiting_approval: number;
  };
  /** completed / (completed + failed) in the window */
  playbook_success_rate_30d: number | null;
  autopilot_logs_last_30d: { dry_run: number; executed: number; blocked: number };
  /** executed / (executed + failed) for mutating attempts in the window */
  autopilot_mutate_success_rate_30d: number | null;
  /** Portfolio metrics proxies (V6 analytics spec). */
  finding_recurrence_clusters: number;
  campaign_drift_velocity_proxy: number;
  low_health_program_scorecards: number;
  confidence_degradation_signal: boolean;
  explainability: {
    recent_finding_ids: string[];
    recent_check_run_ids: string[];
  };
  /** Adoption-style proxies (org metrics JSON and counters, not full product analytics). */
  published_control_policies: number;
  enabled_autopilot_rules: number;
  review_board_runs_last_30d: number;
  incremental_assurance_runs_last_30d: number;
  /** Finding types that appear more than once among open findings (recurrence signal). */
  open_finding_type_recurrence_count: number;
  /** Outcome intervention analysis rows recorded in the last 30 days. */
  outcome_intervention_analyses_last_30d: number;
  /** Count of assurance scorecards by scorecard_type (distribution). */
  scorecards_count_by_type: Record<string, number>;
  /** Median overall_score across recent scorecards (up to 200 rows). */
  median_scorecard_overall: number | null;
  /** Hours since the latest completed portfolio_assurance run, if any. */
  hours_since_last_portfolio_assurance: number | null;
  /** Latest portfolio assurance segment rollup member totals (top segments by member_count). */
  latest_segment_rollup_top: { key: string; name: string; member_count: number }[];
  /** Autopilot blocked + failed in 30d (trust / override proxy). */
  autopilot_blocked_and_failed_30d: { blocked: number; failed: number; reverted: number };
  /**
   * Sum of numeric fields from org_behavior_metrics.v6_assurance_quality_json
   * across daily rows in the last 30 days (adoption / API touch / calibration).
   */
  v6_quality_counters_30d: Record<string, number>;
  /** Policy evaluation pass rate grouped by scope label (assignments / org rollup). */
  policy_pass_rate_by_scope_label: Record<string, number>;
  /** Counts of analyst signal_feedback on resolved/dismissed findings (30d events). */
  finding_resolution_feedback_30d: {
    false_positive: number;
    not_actionable: number;
    confirmed_true: number;
    unlabeled: number;
  };
  /** External counterparty submissions recorded in external_action_events (30d). */
  external_collaboration_submissions_30d: number;
  /** Multi-step external workflow step events (event_type like external.workflow%, 30d). */
  external_workflow_step_events_30d: number;
  /** external.link_created audit events in the window (proxy for links issued). */
  external_link_created_events_30d: number;
  /**
   * Submissions per link-created event in the window (null when no link-created events).
   */
  external_collaboration_submissions_per_link_created_30d: number | null;
  /**
   * Share of labeled resolutions marked false_positive (null if no labeled resolutions in window).
   */
  false_positive_share_of_labeled_feedback_30d: number | null;
  /**
   * Share of labeled resolutions marked confirmed_true (null if no labeled resolutions in window).
   */
  confirmed_true_share_of_labeled_feedback_30d: number | null;
  /**
   * Share of labeled resolutions marked not_actionable (null if no labeled resolutions in window).
   */
  not_actionable_share_of_labeled_feedback_30d: number | null;
  /**
   * Median hours from finding created_at to resolved_at among findings resolved in the window (null if none).
   */
  median_hours_to_resolve_findings_30d: number | null;
  /**
   * Median age in hours of currently open / in_review findings (null if none).
   */
  median_age_hours_open_findings: number | null;
  /**
   * Distinct user IDs recorded under assurance_hub_visitor_ids across daily org_behavior_metrics rows (last 7 days).
   */
  weekly_distinct_assurance_hub_visitors_rolling: number;
  /** Rows in external_action_links created in the last 30 days. */
  external_action_links_created_rows_30d: number;
  /**
   * Links created in the last 30 days whose scope_json includes a non-empty workflow_deadline_iso string.
   * Counted from up to 5000 newest rows in the window (lower bound if the org exceeds that sample).
   */
  external_links_with_workflow_deadline_30d: number;
  /**
   * Submissions per link row created (30d); null when no links were created in the window.
   */
  external_collaboration_submissions_per_link_row_30d: number | null;
};

function aggregatePolicyPassByScope(
  results: Awaited<ReturnType<typeof evaluatePublishedControlPolicies>>
): Record<string, number> {
  const buckets = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const label = (r.scope.label || "unknown").trim() || "unknown";
    const cur = buckets.get(label) ?? { pass: 0, total: 0 };
    cur.total += 1;
    if (r.pass) cur.pass += 1;
    buckets.set(label, cur);
  }
  const out: Record<string, number> = {};
  for (const [label, { pass, total }] of buckets) {
    out[label] = total > 0 ? Number((pass / total).toFixed(4)) : 1;
  }
  return out;
}

function countUniqueAssuranceHubVisitorsRolling(
  rows: { v6_assurance_quality_json?: unknown }[] | null
): number {
  const ids = new Set<string>();
  for (const row of rows ?? []) {
    const j = row.v6_assurance_quality_json;
    if (!j || typeof j !== "object") continue;
    const arr = (j as Record<string, unknown>).assurance_hub_visitor_ids;
    if (!Array.isArray(arr)) continue;
    for (const x of arr) {
      if (typeof x === "string" && x.trim()) ids.add(x.trim());
    }
  }
  return ids.size;
}

function countExternalLinksWithWorkflowDeadline(
  rows: { scope_json?: unknown }[] | null
): number {
  let n = 0;
  for (const row of rows ?? []) {
    const sj = row.scope_json;
    if (!sj || typeof sj !== "object" || Array.isArray(sj)) continue;
    const iso = (sj as Record<string, unknown>).workflow_deadline_iso;
    if (typeof iso === "string" && iso.trim().length > 0) n += 1;
  }
  return n;
}

function sumV6QualityJsonRows(rows: { v6_assurance_quality_json?: unknown }[] | null): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const row of rows ?? []) {
    const j = row.v6_assurance_quality_json;
    if (!j || typeof j !== "object") continue;
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      if (k === "updated_at") continue;
      const n = Number(v);
      if (Number.isFinite(n)) acc[k] = (acc[k] ?? 0) + n;
    }
  }
  return acc;
}

export async function buildAssuranceAnalyticsSummary(
  admin: AdminClient,
  orgId: string
): Promise<AssuranceAnalyticsSummary> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sinceDay = since.slice(0, 10);
  const sevenDayStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { data: findings },
    policyResults,
    { data: pbRuns },
    { data: apLogs },
    { data: checkRuns },
    metrics,
    { count: publishedPolicies },
    { count: enabledAutopilot },
    { count: boardRuns30 },
    { count: incrementalRuns30 },
    { count: outcomeAnalyses30 },
    { data: scorecardRows },
    { data: lastPortfolioRun },
    { data: apLogsDetailed },
    { data: qualityMetricRows },
    { data: findingFeedbackEvents },
    { count: externalSubmissions30 },
    { count: externalLinkCreated30 },
    { data: resolvedFindingsWindow },
    { data: qualityMetrics7d },
    { count: externalLinkRows30 },
    { count: externalWorkflowSteps30 },
    { data: externalLinkScopes30d },
  ] = await Promise.all([
    admin
      .from("assurance_findings")
      .select("id, severity, status, finding_type, created_at")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_review"]),
    evaluatePublishedControlPolicies(admin, orgId),
    admin
      .from("adaptive_playbook_runs")
      .select("status")
      .eq("organization_id", orgId)
      .gte("created_at", since),
    admin
      .from("autopilot_run_logs")
      .select("status")
      .eq("organization_id", orgId)
      .gte("created_at", since),
    admin
      .from("assurance_check_runs")
      .select("id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    gatherPortfolioMetrics(admin, orgId),
    admin
      .from("control_policies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "published"),
    admin
      .from("autopilot_rules")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("enabled", true),
    admin
      .from("review_board_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("generated_at", since),
    admin
      .from("assurance_check_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("check_type", "incremental_assurance")
      .gte("created_at", since),
    admin
      .from("outcome_intervention_analyses")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("analyzed_at", since),
    admin
      .from("assurance_scorecards")
      .select("scorecard_type, overall_score")
      .eq("organization_id", orgId)
      .limit(200),
    admin
      .from("assurance_check_runs")
      .select("completed_at, created_at, summary_json")
      .eq("organization_id", orgId)
      .eq("check_type", "portfolio_assurance")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("autopilot_run_logs")
      .select("status")
      .eq("organization_id", orgId)
      .gte("created_at", since),
    admin
      .from("org_behavior_metrics")
      .select("v6_assurance_quality_json")
      .eq("organization_id", orgId)
      .gte("metrics_date", sinceDay),
    admin
      .from("assurance_finding_events")
      .select("event_type, payload_json")
      .eq("organization_id", orgId)
      .gte("created_at", since)
      .in("event_type", ["finding.resolved", "finding.dismissed"])
      .limit(2500),
    admin
      .from("external_action_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("event_type", "external.submitted")
      .gte("created_at", since),
    admin
      .from("external_action_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("event_type", "external.link_created")
      .gte("created_at", since),
    admin
      .from("assurance_findings")
      .select("created_at, resolved_at")
      .eq("organization_id", orgId)
      .eq("status", "resolved")
      .not("resolved_at", "is", null)
      .gte("resolved_at", since)
      .limit(500),
    admin
      .from("org_behavior_metrics")
      .select("v6_assurance_quality_json")
      .eq("organization_id", orgId)
      .gte("metrics_date", sevenDayStart),
    admin
      .from("external_action_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", since),
    admin
      .from("external_action_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", since)
      .like("event_type", "external.workflow%"),
    admin
      .from("external_action_links")
      .select("scope_json")
      .eq("organization_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const open_findings_by_severity: Record<string, number> = {};
  const open_findings_by_type: Record<string, number> = {};
  for (const f of findings ?? []) {
    const sev = String((f as { severity: string }).severity);
    open_findings_by_severity[sev] = (open_findings_by_severity[sev] ?? 0) + 1;
    const ft = String((f as { finding_type?: string }).finding_type ?? "unknown");
    open_findings_by_type[ft] = (open_findings_by_type[ft] ?? 0) + 1;
  }
  const open_finding_type_recurrence_count = Object.values(open_findings_by_type).filter((n) => n >= 2).length;

  const passed = policyResults.filter((p) => p.pass).length;
  const policy_pass_rate = policyResults.length ? passed / policyResults.length : 1;

  let completed = 0;
  let failed = 0;
  let awaiting_approval = 0;
  for (const r of pbRuns ?? []) {
    const s = String((r as { status: string }).status);
    if (s === "completed") completed += 1;
    else if (s === "failed") failed += 1;
    else if (s === "awaiting_approval") awaiting_approval += 1;
  }

  let dry_run = 0;
  let executed = 0;
  let blocked = 0;
  for (const r of apLogs ?? []) {
    const s = String((r as { status: string }).status);
    if (s === "dry_run") dry_run += 1;
    else if (s === "executed") executed += 1;
    else if (s === "blocked") blocked += 1;
  }

  const pbTerminal = completed + failed;
  const playbook_success_rate_30d = pbTerminal > 0 ? Number((completed / pbTerminal).toFixed(4)) : null;
  const apFailed = (apLogs ?? []).filter((r) => String((r as { status: string }).status) === "failed").length;
  const apMutateDenom = executed + apFailed;
  const autopilot_mutate_success_rate_30d =
    apMutateDenom > 0 ? Number((executed / apMutateDenom).toFixed(4)) : null;

  const { data: lastTwoRuns } = await admin
    .from("assurance_check_runs")
    .select("risk_delta_json")
    .eq("organization_id", orgId)
    .eq("check_type", "portfolio_assurance")
    .order("created_at", { ascending: false })
    .limit(2);
  const confidence_degradation_signal = Boolean(
    (lastTwoRuns ?? []).some((row) => {
      const rd = (row as { risk_delta_json?: { confidence_degradation?: boolean } }).risk_delta_json;
      return rd?.confidence_degradation === true;
    })
  );

  const recent_finding_ids = (findings ?? [])
    .slice(0, 8)
    .map((f) => String((f as { id: string }).id));
  const recent_check_run_ids = (checkRuns ?? []).map((c) => String((c as { id: string }).id));

  const scorecards_count_by_type: Record<string, number> = {};
  const scores: number[] = [];
  for (const r of scorecardRows ?? []) {
    const t = String((r as { scorecard_type: string }).scorecard_type ?? "unknown");
    scorecards_count_by_type[t] = (scorecards_count_by_type[t] ?? 0) + 1;
    const v = Number((r as { overall_score: number }).overall_score);
    if (Number.isFinite(v)) scores.push(v);
  }
  scores.sort((a, b) => a - b);
  const median_scorecard_overall =
    scores.length === 0
      ? null
      : scores.length % 2 === 1
        ? scores[(scores.length - 1) / 2]
        : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2;

  const runRow = lastPortfolioRun as { completed_at?: string; created_at?: string; summary_json?: unknown } | null;
  const runTs = runRow?.completed_at ?? runRow?.created_at;
  const hours_since_last_portfolio_assurance =
    runTs && !Number.isNaN(Date.parse(runTs))
      ? Number(((Date.now() - Date.parse(runTs)) / 3600000).toFixed(2))
      : null;

  const segRoll =
    runRow?.summary_json &&
    typeof runRow.summary_json === "object" &&
    runRow.summary_json !== null &&
    "segment_rollups" in runRow.summary_json
      ? (runRow.summary_json as { segment_rollups?: { key: string; name: string; member_count: number }[] })
          .segment_rollups
      : undefined;
  const latest_segment_rollup_top = Array.isArray(segRoll)
    ? [...segRoll].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0)).slice(0, 8)
    : [];

  let apBlocked30 = 0;
  let apFailed30 = 0;
  let apReverted30 = 0;
  for (const r of apLogsDetailed ?? []) {
    const s = String((r as { status: string }).status);
    if (s === "blocked") apBlocked30 += 1;
    else if (s === "failed") apFailed30 += 1;
    else if (s === "reverted") apReverted30 += 1;
  }

  const v6_quality_counters_30d = sumV6QualityJsonRows(qualityMetricRows ?? []);
  const policy_pass_rate_by_scope_label = aggregatePolicyPassByScope(policyResults);

  const finding_resolution_feedback_30d = {
    false_positive: 0,
    not_actionable: 0,
    confirmed_true: 0,
    unlabeled: 0,
  };
  for (const ev of findingFeedbackEvents ?? []) {
    const payload = (ev as { payload_json?: unknown }).payload_json;
    const fb =
      payload && typeof payload === "object" && payload !== null && "signal_feedback" in payload
        ? String((payload as { signal_feedback?: string }).signal_feedback ?? "").trim().toLowerCase()
        : "";
    if (fb === "false_positive") finding_resolution_feedback_30d.false_positive += 1;
    else if (fb === "not_actionable") finding_resolution_feedback_30d.not_actionable += 1;
    else if (fb === "confirmed_true") finding_resolution_feedback_30d.confirmed_true += 1;
    else finding_resolution_feedback_30d.unlabeled += 1;
  }

  const resolveHours: number[] = [];
  for (const row of resolvedFindingsWindow ?? []) {
    const c = (row as { created_at?: string; resolved_at?: string }).created_at;
    const r = (row as { created_at?: string; resolved_at?: string }).resolved_at;
    if (!c || !r) continue;
    const ms = Date.parse(r) - Date.parse(c);
    if (!Number.isFinite(ms) || ms < 0) continue;
    resolveHours.push(ms / 3600000);
  }
  resolveHours.sort((a, b) => a - b);
  const median_hours_to_resolve_findings_30d =
    resolveHours.length === 0
      ? null
      : resolveHours.length % 2 === 1
        ? Number(resolveHours[(resolveHours.length - 1) / 2].toFixed(2))
        : Number(
            (
              (resolveHours[resolveHours.length / 2 - 1] + resolveHours[resolveHours.length / 2]) /
              2
            ).toFixed(2)
          );

  const subs30 = externalSubmissions30 ?? 0;
  const links30 = externalLinkCreated30 ?? 0;
  const external_collaboration_submissions_per_link_created_30d =
    links30 > 0 ? Number((subs30 / links30).toFixed(4)) : null;

  const labeledFeedback =
    finding_resolution_feedback_30d.false_positive +
    finding_resolution_feedback_30d.not_actionable +
    finding_resolution_feedback_30d.confirmed_true;
  const false_positive_share_of_labeled_feedback_30d =
    labeledFeedback > 0
      ? Number((finding_resolution_feedback_30d.false_positive / labeledFeedback).toFixed(4))
      : null;
  const confirmed_true_share_of_labeled_feedback_30d =
    labeledFeedback > 0
      ? Number((finding_resolution_feedback_30d.confirmed_true / labeledFeedback).toFixed(4))
      : null;
  const not_actionable_share_of_labeled_feedback_30d =
    labeledFeedback > 0
      ? Number((finding_resolution_feedback_30d.not_actionable / labeledFeedback).toFixed(4))
      : null;

  const openAgeHours: number[] = [];
  for (const f of findings ?? []) {
    const c = (f as { created_at?: string }).created_at;
    if (!c) continue;
    const h = (Date.now() - Date.parse(c)) / 3600000;
    if (Number.isFinite(h) && h >= 0) openAgeHours.push(h);
  }
  openAgeHours.sort((a, b) => a - b);
  const median_age_hours_open_findings =
    openAgeHours.length === 0
      ? null
      : openAgeHours.length % 2 === 1
        ? Number(openAgeHours[(openAgeHours.length - 1) / 2].toFixed(2))
        : Number(
            (
              (openAgeHours[openAgeHours.length / 2 - 1] + openAgeHours[openAgeHours.length / 2]) /
              2
            ).toFixed(2)
          );

  const weekly_distinct_assurance_hub_visitors_rolling = countUniqueAssuranceHubVisitorsRolling(
    qualityMetrics7d ?? []
  );
  const linkRows30 = externalLinkRows30 ?? 0;
  const external_collaboration_submissions_per_link_row_30d =
    linkRows30 > 0 ? Number((subs30 / linkRows30).toFixed(4)) : null;
  const external_links_with_workflow_deadline_30d = countExternalLinksWithWorkflowDeadline(
    externalLinkScopes30d ?? null
  );

  return {
    generated_at: new Date().toISOString(),
    open_findings_by_severity,
    open_findings_by_type,
    policy_pass_rate: Number(policy_pass_rate.toFixed(4)),
    policy_evaluation_units: policyResults.length,
    playbook_runs_last_30d: { completed, failed, awaiting_approval },
    playbook_success_rate_30d,
    autopilot_logs_last_30d: { dry_run, executed, blocked },
    autopilot_mutate_success_rate_30d,
    finding_recurrence_clusters: metrics.repeat_exception_type_clusters ?? 0,
    campaign_drift_velocity_proxy: metrics.campaigns_with_drift_concern ?? 0,
    low_health_program_scorecards: metrics.low_health_program_scorecards ?? 0,
    confidence_degradation_signal,
    explainability: { recent_finding_ids, recent_check_run_ids },
    published_control_policies: publishedPolicies ?? 0,
    enabled_autopilot_rules: enabledAutopilot ?? 0,
    review_board_runs_last_30d: boardRuns30 ?? 0,
    incremental_assurance_runs_last_30d: incrementalRuns30 ?? 0,
    open_finding_type_recurrence_count: open_finding_type_recurrence_count,
    outcome_intervention_analyses_last_30d: outcomeAnalyses30 ?? 0,
    scorecards_count_by_type,
    median_scorecard_overall:
      median_scorecard_overall != null ? Number(median_scorecard_overall.toFixed(2)) : null,
    hours_since_last_portfolio_assurance,
    latest_segment_rollup_top,
    autopilot_blocked_and_failed_30d: {
      blocked: apBlocked30,
      failed: apFailed30,
      reverted: apReverted30,
    },
    v6_quality_counters_30d,
    policy_pass_rate_by_scope_label,
    finding_resolution_feedback_30d,
    external_collaboration_submissions_30d: subs30,
    external_workflow_step_events_30d: externalWorkflowSteps30 ?? 0,
    external_link_created_events_30d: links30,
    external_collaboration_submissions_per_link_created_30d,
    false_positive_share_of_labeled_feedback_30d,
    confirmed_true_share_of_labeled_feedback_30d,
    not_actionable_share_of_labeled_feedback_30d,
    median_hours_to_resolve_findings_30d,
    median_age_hours_open_findings,
    weekly_distinct_assurance_hub_visitors_rolling,
    external_action_links_created_rows_30d: linkRows30,
    external_links_with_workflow_deadline_30d,
    external_collaboration_submissions_per_link_row_30d,
  };
}
