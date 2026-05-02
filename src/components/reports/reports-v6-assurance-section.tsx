import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  ExternalLink,
  GitBranch,
  Layers,
  PieChart,
  PlayCircle,
  Radio,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import type { AssuranceAnalyticsSummary } from "@/lib/v6/assurance-analytics";
import {
  OperationalMetricChip,
  OperationalSectionHeader,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { OPERATIONAL_SHELL_BY_TONE } from "@/lib/ui/operational-surface";
import type { OperationalTone } from "@/lib/ui/operational-surface";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-1)] ${OPERATIONAL_SHELL_BY_TONE.neutral} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function sumSeverity(a: Record<string, number>): number {
  return Object.values(a).reduce((s, n) => s + n, 0);
}

export function ReportsV6AssuranceAnalyticsSection(props: {
  analytics: AssuranceAnalyticsSummary;
  canViewAssuranceOps: boolean;
  showAssuranceMode: boolean;
}) {
  if (!props.showAssuranceMode) {
    return (
      <section id="assurance-analytics" className="scroll-mt-8 space-y-4">
        <OperationalSectionHeader
          eyebrow="Assurance"
          title="Assurance analytics"
          description="Assurance analytics are hidden for this workspace mode."
        />
      </section>
    );
  }
  const a = props.analytics;
  const openSev = a.open_findings_by_severity;
  const openTotal = sumSeverity(openSev);
  const sevChips = Object.entries(openSev).map(([k, n]) => ({
    label: k,
    value: String(n),
  }));
  const playbookTone: OperationalTone =
    a.playbook_runs_last_30d.failed > 0 ? "attention" : "healthy";
  const autopilotTone: OperationalTone = a.autopilot_logs_last_30d.blocked > 0 ? "attention" : "neutral";

  return (
    <section id="assurance-analytics" className="scroll-mt-8 space-y-4">
      <OperationalSectionHeader
        eyebrow="Assurance"
        title="Assurance analytics"
        description="Native assurance rates: policy pass, playbook throughput, autopilot posture, and finding mix."
      />

      {props.canViewAssuranceOps ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OperationalSummaryCard
              eyebrow="Policies"
              headline="Pass rate"
              tone="neutral"
              icon={ShieldCheck}
              primaryValue={`${(a.policy_pass_rate * 100).toFixed(1)}%`}
              primaryUnit="evaluations"
              breakdown={[{ label: "Units", value: String(a.policy_evaluation_units) }]}
              action={{ href: "/assurance/control-policies", label: "Review policies" }}
              variant="compact"
            />
            <OperationalSummaryCard
              eyebrow="Findings"
              headline="Open by severity"
              tone={openTotal > 0 ? "attention" : "healthy"}
              icon={Layers}
              primaryValue={openTotal}
              primaryUnit="open findings"
              breakdown={sevChips.length ? sevChips : [{ label: "Status", value: "None open" }]}
              action={{ href: "/assurance/findings", label: "Review findings" }}
              variant="compact"
            />
            <OperationalSummaryCard
              eyebrow="Automation"
              headline="Playbooks (30d)"
              tone={playbookTone}
              icon={PlayCircle}
              primaryValue={a.playbook_runs_last_30d.completed}
              primaryUnit="completed"
              breakdown={[
                { label: "Failed", value: String(a.playbook_runs_last_30d.failed) },
                { label: "Awaiting approval", value: String(a.playbook_runs_last_30d.awaiting_approval) },
              ]}
              action={{ href: "/assurance/playbooks", label: "Review playbooks" }}
              variant="compact"
            />
            <OperationalSummaryCard
              eyebrow="Guardrails"
              headline="Autopilot (30d)"
              tone={autopilotTone}
              icon={Radio}
              primaryValue={a.autopilot_logs_last_30d.executed}
              primaryUnit="executed"
              breakdown={[
                { label: "Dry-run", value: String(a.autopilot_logs_last_30d.dry_run) },
                { label: "Blocked", value: String(a.autopilot_logs_last_30d.blocked) },
              ]}
              action={{ href: "/assurance/autopilot", label: "Review autopilot" }}
              variant="compact"
            />
          </div>

          <details className="ui-soft-details">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
              Advanced assurance diagnostics
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <OperationalSummaryCard
                eyebrow="Portfolio"
                headline="Recurrence clusters"
                tone="neutral"
                icon={BarChart3}
                primaryValue={a.finding_recurrence_clusters}
                primaryUnit="distinct patterns"
                action={{ href: "/reports#assurance-analytics", label: "Anchor section" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Campaigns"
                headline="Drift velocity"
                tone="neutral"
                icon={GitBranch}
                primaryValue={a.campaign_drift_velocity_proxy}
                primaryUnit="proxy count"
                action={{ href: "/campaigns", label: "Review campaigns" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Playbooks"
                headline="Success rate (30d)"
                tone={playbookTone}
                icon={PlayCircle}
                primaryValue={
                  a.playbook_success_rate_30d != null
                    ? `${(a.playbook_success_rate_30d * 100).toFixed(1)}%`
                    : "—"
                }
                primaryUnit="completed vs failed"
                action={{ href: "/assurance/playbooks", label: "Review playbooks" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Autopilot"
                headline="Mutate success (30d)"
                tone="neutral"
                icon={Radio}
                primaryValue={
                  a.autopilot_mutate_success_rate_30d != null
                    ? `${(a.autopilot_mutate_success_rate_30d * 100).toFixed(1)}%`
                    : "—"
                }
                primaryUnit="executed vs failed"
                action={{ href: "/assurance/autopilot", label: "Review autopilot" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Scorecards"
                headline="Weak programs"
                tone={a.low_health_program_scorecards > 0 ? "attention" : "healthy"}
                icon={AlertTriangle}
                primaryValue={a.low_health_program_scorecards}
                primaryUnit="under threshold (52)"
                action={{ href: "/assurance/scorecards", label: "Review scorecards" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Signals"
                headline="Confidence drop"
                tone={a.confidence_degradation_signal ? "risk" : "healthy"}
                icon={Activity}
                primaryValue={a.confidence_degradation_signal ? "Yes" : "No"}
                primaryUnit="latest vs prior run"
                action={{ href: "/api/assurance/check-runs?limit=20", label: "Check runs JSON", external: true }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Findings"
                headline="Type recurrence"
                tone="neutral"
                icon={Layers}
                primaryValue={a.open_finding_type_recurrence_count}
                primaryUnit="types with 2+ open"
                action={{ href: "/assurance/findings", label: "Review findings" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Outcomes"
                headline="Analyses (30d)"
                tone="neutral"
                icon={BarChart3}
                primaryValue={a.outcome_intervention_analyses_last_30d}
                primaryUnit="rows recorded"
                action={{ href: "/reports#outcome-intelligence", label: "Outcome intelligence" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Scorecards"
                headline="Median overall"
                tone="neutral"
                icon={Target}
                primaryValue={a.median_scorecard_overall != null ? a.median_scorecard_overall.toFixed(1) : "—"}
                primaryUnit="sample (≤200)"
                action={{ href: "/assurance/scorecards", label: "Review scorecards" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Checks"
                headline="Hours since portfolio run"
                tone="neutral"
                icon={Clock}
                primaryValue={
                  a.hours_since_last_portfolio_assurance != null
                    ? a.hours_since_last_portfolio_assurance.toFixed(1)
                    : "—"
                }
                primaryUnit="hours"
                action={{ href: "/api/assurance/check-runs?limit=20", label: "Check runs JSON", external: true }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Trust"
                headline="Autopilot overrides (30d)"
                tone={a.autopilot_blocked_and_failed_30d.blocked > 0 ? "attention" : "neutral"}
                icon={AlertTriangle}
                primaryValue={a.autopilot_blocked_and_failed_30d.blocked}
                primaryUnit="blocked"
                breakdown={[
                  { label: "Failed", value: String(a.autopilot_blocked_and_failed_30d.failed) },
                  { label: "Reverted", value: String(a.autopilot_blocked_and_failed_30d.reverted) },
                ]}
                action={{ href: "/assurance/autopilot", label: "Review autopilot" }}
                variant="compact"
              />
              <OperationalSummaryCard
                eyebrow="Distribution"
                headline="Scorecards by type"
                tone="neutral"
                icon={PieChart}
                primaryValue={Object.keys(a.scorecards_count_by_type).length}
                primaryUnit="entity types"
                breakdown={Object.entries(a.scorecards_count_by_type).map(([t, n]) => ({
                  label: t,
                  value: String(n),
                }))}
                action={{ href: "/assurance/scorecards", label: "Review scorecards" }}
                variant="compact"
              />
            </div>

            {a.latest_segment_rollup_top.length > 0 ? (
              <Panel className="mt-3 sm:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Latest run — top segments
                </p>
                <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  {a.latest_segment_rollup_top.map((s) => (
                    <li key={s.key} className="flex justify-between gap-4">
                      <span>
                        {s.name} <span className="font-mono text-[10px] text-[var(--text-tertiary)]">({s.key})</span>
                      </span>
                      <span className="tabular-nums font-medium">{s.member_count} members</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <Panel className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Adoption (30d)
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="list">
                <OperationalMetricChip
                  label="Incremental runs"
                  value={String(a.incremental_assurance_runs_last_30d)}
                />
                <OperationalMetricChip label="Review boards" value={String(a.review_board_runs_last_30d)} />
                <OperationalMetricChip label="Published policies" value={String(a.published_control_policies)} />
                <OperationalMetricChip label="Autopilot rules" value={String(a.enabled_autopilot_rules)} />
              </div>
            </Panel>

            <Panel className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Quality counters (30d rollup)
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Summed across daily org_behavior_metrics rows (API reads, response packs, labels, notifications).
              </p>
              {Object.keys(a.v6_quality_counters_30d).length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-tertiary)]">No counters in this window.</p>
              ) : (
                <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-[var(--text-secondary)]">
                  {Object.entries(a.v6_quality_counters_30d)
                    .filter(([, n]) => n > 0)
                    .sort((x, y) => y[1] - x[1])
                    .map(([k, n]) => (
                      <li
                        key={k}
                        className="flex justify-between gap-4 rounded border border-[var(--border-subtle)] bg-surface/70 px-2 py-1 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]"
                      >
                        <span className="font-mono text-[11px] text-[var(--text-secondary)]">{k}</span>
                        <span className="tabular-nums font-semibold text-[var(--text-primary)]">{n}</span>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>

            <Panel className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Finding calibration (30d)
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="list">
                <OperationalMetricChip
                  label="False positive"
                  value={String(a.finding_resolution_feedback_30d.false_positive)}
                />
                <OperationalMetricChip
                  label="Not actionable"
                  value={String(a.finding_resolution_feedback_30d.not_actionable)}
                />
                <OperationalMetricChip
                  label="Confirmed"
                  value={String(a.finding_resolution_feedback_30d.confirmed_true)}
                />
                <OperationalMetricChip
                  label="Unlabeled"
                  value={String(a.finding_resolution_feedback_30d.unlabeled)}
                />
                <OperationalMetricChip
                  label="Median resolve (h)"
                  value={
                    a.median_hours_to_resolve_findings_30d != null
                      ? String(a.median_hours_to_resolve_findings_30d)
                      : "—"
                  }
                />
                <OperationalMetricChip
                  label="Median open age (h)"
                  value={
                    a.median_age_hours_open_findings != null
                      ? String(a.median_age_hours_open_findings)
                      : "—"
                  }
                />
                <OperationalMetricChip
                  label="FP share labeled"
                  value={
                    a.false_positive_share_of_labeled_feedback_30d != null
                      ? `${(a.false_positive_share_of_labeled_feedback_30d * 100).toFixed(1)}%`
                      : "—"
                  }
                />
                <OperationalMetricChip
                  label="Confirmed share"
                  value={
                    a.confirmed_true_share_of_labeled_feedback_30d != null
                      ? `${(a.confirmed_true_share_of_labeled_feedback_30d * 100).toFixed(1)}%`
                      : "—"
                  }
                />
                <OperationalMetricChip
                  label="N/A share"
                  value={
                    a.not_actionable_share_of_labeled_feedback_30d != null
                      ? `${(a.not_actionable_share_of_labeled_feedback_30d * 100).toFixed(1)}%`
                      : "—"
                  }
                />
              </div>
            </Panel>

            <OperationalSummaryCard
              eyebrow="External"
              headline="Collaboration yield (30d)"
              tone="neutral"
              icon={ExternalLink}
              primaryValue={
                a.external_collaboration_submissions_per_link_created_30d != null
                  ? a.external_collaboration_submissions_per_link_created_30d.toFixed(2)
                  : "—"
              }
              primaryUnit="submissions / link-created event"
              breakdown={[
                { label: "Submissions", value: String(a.external_collaboration_submissions_30d) },
                { label: "Link-created evt", value: String(a.external_link_created_events_30d) },
                { label: "Workflow steps", value: String(a.external_workflow_step_events_30d) },
                { label: "Link rows", value: String(a.external_action_links_created_rows_30d) },
                {
                  label: "With deadline",
                  value: String(a.external_links_with_workflow_deadline_30d),
                },
                {
                  label: "Submissions / row",
                  value:
                    a.external_collaboration_submissions_per_link_row_30d != null
                      ? a.external_collaboration_submissions_per_link_row_30d.toFixed(2)
                      : "—",
                },
              ]}
              action={{ href: "/contracts/collaboration", label: "View collaboration" }}
              variant="compact"
              className="mt-3"
            />

            <OperationalSummaryCard
              eyebrow="Adoption"
              headline="Assurance hub visitors"
              tone="neutral"
              icon={Users}
              primaryValue={a.weekly_distinct_assurance_hub_visitors_rolling}
              primaryUnit="distinct users (7d)"
              action={{ href: "/assurance", label: "Open assurance hub" }}
              variant="compact"
              className="mt-3"
            />

            <Panel className="mt-3 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Policy pass rate by scope
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">Per evaluation unit before averaging.</p>
              {Object.keys(a.policy_pass_rate_by_scope_label).length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-tertiary)]">No published policy evaluations.</p>
              ) : (
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-[var(--text-secondary)]">
                  {Object.entries(a.policy_pass_rate_by_scope_label)
                    .sort((x, y) => x[0].localeCompare(y[0]))
                    .map(([scope, rate]) => (
                      <li
                        key={scope}
                        className="flex justify-between gap-4 rounded border border-[var(--border-subtle)] bg-surface/70 px-2 py-1"
                      >
                        <span className="truncate" title={scope}>
                          {scope}
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold">{(rate * 100).toFixed(1)}%</span>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          </details>

          {Object.keys(a.open_findings_by_type).length > 0 ? (
            <Panel className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Open findings by type
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="list">
                {Object.entries(a.open_findings_by_type).map(([t, n]) => (
                  <OperationalMetricChip key={t} label={t} value={String(n)} />
                ))}
              </div>
            </Panel>
          ) : null}

          <Link href="/api/assurance/analytics/summary" className="ui-link mt-3 inline-block text-xs" target="_blank" rel="noreferrer">
            Open assurance analytics JSON
          </Link>
        </>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          Detailed assurance analytics are limited to workspace operators. Open the{" "}
          <Link className="ui-link" href="/assurance" prefetch={false}>
            Assurance hub
          </Link>{" "}
          for your available views.
        </p>
      )}
    </section>
  );
}
