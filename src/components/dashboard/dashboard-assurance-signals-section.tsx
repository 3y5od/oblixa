import Link from "next/link";
import { PlayCircle, Radio, ShieldCheck } from "lucide-react";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import type { AssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";

export function DashboardAssuranceSignalsSection(props: {
  analytics: AssuranceAnalyticsSummary;
  visibility: { controlPolicies: boolean; playbooks: boolean; automationOps: boolean };
  showAssuranceMode: boolean;
}) {
  if (!props.showAssuranceMode) return null;
  const a = props.analytics;
  const { visibility } = props;
  const playbookFailTone: OperationalTone = a.playbook_runs_last_30d.failed > 0 ? "attention" : "healthy";
  const autopilotTone: OperationalTone = a.autopilot_logs_last_30d.blocked > 0 ? "attention" : "neutral";

  return (
    <section className="space-y-4">
      <div>
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Signals
        </p>
        <h2 className="ui-section-title mt-2 text-xl">Operational signal summary</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {visibility.controlPolicies ? (
          <OperationalSummaryCard
            eyebrow="Policies"
            headline="Pass rate"
            tone="neutral"
            icon={ShieldCheck}
            primaryValue={`${(a.policy_pass_rate * 100).toFixed(1)}%`}
            primaryUnit="evaluations"
            breakdown={[{ label: "Units", value: String(a.policy_evaluation_units) }]}
            action={{ href: "/api/assurance/analytics/summary", label: "Analytics JSON", external: true }}
            variant="compact"
          />
        ) : null}
        {visibility.playbooks ? (
          <OperationalSummaryCard
            eyebrow="Playbooks"
            headline="Success (30d)"
            tone={playbookFailTone}
            icon={PlayCircle}
            primaryValue={
              a.playbook_success_rate_30d != null
                ? `${(a.playbook_success_rate_30d * 100).toFixed(1)}%`
                : "-"
            }
            primaryUnit="success rate"
            breakdown={[
              { label: "Completed", value: String(a.playbook_runs_last_30d.completed) },
              { label: "Failed", value: String(a.playbook_runs_last_30d.failed) },
            ]}
            action={{ href: "/assurance", label: "Assurance hub" }}
            variant="compact"
          />
        ) : null}
        {visibility.automationOps ? (
          <OperationalSummaryCard
            eyebrow="Autopilot"
            headline="Guardrails"
            tone={autopilotTone}
            icon={Radio}
            primaryValue={a.autopilot_logs_last_30d.blocked}
            primaryUnit="blocked (30d)"
            breakdown={[
              { label: "Executed", value: String(a.autopilot_logs_last_30d.executed) },
              { label: "Dry-run", value: String(a.autopilot_logs_last_30d.dry_run) },
            ]}
            action={{ href: "/reports#assurance-analytics", label: "Review reports" }}
            variant="compact"
          />
        ) : null}
      </div>
      <details className="ui-soft-details text-xs text-[var(--text-secondary)]">
        <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Full assurance diagnostics</summary>
        <ul className="ui-compact-list mt-2">
          <li className="ui-compact-list-item">
            Recurrence clusters: <span className="tabular-nums">{a.finding_recurrence_clusters}</span>
          </li>
          <li className="ui-compact-list-item">
            Campaign drift proxy: <span className="tabular-nums">{a.campaign_drift_velocity_proxy}</span>
          </li>
          <li className="ui-compact-list-item">
            Median resolve time:{" "}
            {a.median_hours_to_resolve_findings_30d != null
              ? `${a.median_hours_to_resolve_findings_30d}h`
              : "n/a"}
          </li>
          <li className="ui-compact-list-item">
            Hub users (7d):{" "}
            <span className="tabular-nums">{a.weekly_distinct_assurance_hub_visitors_rolling}</span>
          </li>
        </ul>
      </details>
      <div className="flex flex-wrap gap-2 text-xs">
        <ApiJsonLink className="ui-link" href="/api/assurance/analytics/summary">
          Analytics JSON
        </ApiJsonLink>
        <Link className="ui-link" href="/assurance" prefetch={false}>
          Assurance hub
        </Link>
        <Link className="ui-link" href="/reports#assurance-analytics">
          Reports
        </Link>
      </div>
    </section>
  );
}
