import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  ListOrdered,
  PlayCircle,
  Radio,
  Share2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import type { AssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";

type V6Snapshot = {
  openFindings: number;
  highSeverity: number;
  avgScore: number | null;
  playbooksRunning: number;
  playbooksAwaitingApproval: number;
  graphEdges: number;
  publishedPolicies: number;
};

type OutcomeSummary = {
  analysesCount: number;
  overallAvgEffectiveness: string | number | null;
  effectivenessTrendDelta: string | number | null;
};

type OutcomeRow = {
  id: string;
  intervention_type: string;
  effectiveness_score: number;
  recurrence_delta: number;
};

type AssuranceDashboardVisibility = {
  findings: boolean;
  controlPolicies: boolean;
  healthGraph: boolean;
  playbooks: boolean;
  reviewBoards: boolean;
  scorecards: boolean;
  programEvolution: boolean;
  automationOps: boolean;
};

function findingsTone(open: number, high: number): OperationalTone {
  if (high > 0) return "risk";
  if (open > 0) return "attention";
  return "healthy";
}

export function DashboardV6AssuranceSnapshotSection(props: {
  v6Snapshot: V6Snapshot;
  v6Analytics: AssuranceAnalyticsSummary | null;
  watchSignalsPreview: string[];
  recommendedPreview: string[];
  v6PriorAssuranceRun: { created_at?: string } | null;
  v6LastAssuranceRun: {
    created_at?: string;
    risk_delta_json?: { confidence_degradation?: boolean } | null;
  } | null;
  canViewAssuranceOps: boolean;
  visibility: AssuranceDashboardVisibility;
  showAssuranceMode: boolean;
}) {
  if (!props.showAssuranceMode) return null;
  const {
    v6Snapshot,
    v6Analytics,
    watchSignalsPreview,
    recommendedPreview,
    v6PriorAssuranceRun,
    v6LastAssuranceRun,
    canViewAssuranceOps,
    visibility,
  } = props;

  const watchTone: OperationalTone = watchSignalsPreview.length > 0 ? "attention" : "healthy";
  const recTone: OperationalTone = recommendedPreview.length > 0 ? "neutral" : "healthy";
  const playbookTone: OperationalTone =
    v6Snapshot.playbooksAwaitingApproval > 0
      ? "attention"
      : v6Snapshot.playbooksRunning > 0
        ? "neutral"
        : "healthy";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="landing-eyebrow-dot" aria-hidden />
            Assurance
          </p>
          <h2 className="ui-section-title mt-2 text-xl">Portfolio assurance snapshot</h2>
        </div>
        <p className="text-[12.5px] font-medium text-[var(--text-tertiary)]">
          Avg scorecard{" "}
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
            {v6Snapshot.avgScore !== null ? v6Snapshot.avgScore : "—"}
          </span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibility.findings ? (
          <OperationalSummaryCard
            eyebrow="Queue"
            headline="Findings backlog"
            tone={findingsTone(v6Snapshot.openFindings, v6Snapshot.highSeverity)}
            icon={ClipboardList}
            primaryValue={v6Snapshot.openFindings}
            primaryUnit="open findings"
            breakdown={[{ label: "High / critical", value: String(v6Snapshot.highSeverity) }]}
            action={{ href: "/assurance/findings", label: "Review findings" }}
            variant="compact"
          />
        ) : null}
        {visibility.controlPolicies ? (
          <OperationalSummaryCard
            eyebrow="Controls"
            headline="Control posture"
            tone={v6Snapshot.publishedPolicies > 0 ? "neutral" : "attention"}
            icon={ShieldCheck}
            primaryValue={v6Snapshot.publishedPolicies}
            primaryUnit="published policies"
            breakdown={
              v6Analytics
                ? [{ label: "Pass rate", value: `${(v6Analytics.policy_pass_rate * 100).toFixed(0)}%` }]
                : []
            }
            action={{ href: "/assurance/control-policies", label: "Review policies" }}
            variant="compact"
          />
        ) : null}
        {visibility.healthGraph ? (
          <OperationalSummaryCard
            eyebrow="Graph"
            headline="Propagation risk"
            tone={v6Snapshot.graphEdges > 0 ? "neutral" : "healthy"}
            icon={Share2}
            primaryValue={v6Snapshot.graphEdges}
            primaryUnit="health graph edges"
            action={{ href: "/assurance/health-graph", label: "Inspect health graph" }}
            variant="compact"
          />
        ) : null}
        {visibility.playbooks ? (
          <OperationalSummaryCard
            eyebrow="Automation"
            headline="Playbooks"
            tone={playbookTone}
            icon={PlayCircle}
            primaryValue={v6Snapshot.playbooksRunning}
            primaryUnit="running now"
            breakdown={[
              { label: "Awaiting approval", value: String(v6Snapshot.playbooksAwaitingApproval) },
            ]}
            action={{ href: "/assurance/playbooks", label: "Review playbooks" }}
            variant="compact"
          />
        ) : null}
        {visibility.reviewBoards ? (
          <OperationalSummaryCard
            eyebrow="Checks"
            headline="Watch signals"
            tone={watchTone}
            icon={Radio}
            primaryValue={watchSignalsPreview.length}
            primaryUnit="preview rows"
            breakdown={
              watchSignalsPreview.length
                ? [{ label: "Latest", value: watchSignalsPreview.join(", ").slice(0, 72) }]
                : []
            }
            action={{ href: "/api/assurance/check-runs?limit=40", label: "Inspect check-run feed", external: true }}
            variant="compact"
          />
        ) : null}
        {visibility.scorecards ? (
          <OperationalSummaryCard
            eyebrow="Routing"
            headline="Recommended next"
            tone={recTone}
            icon={ListOrdered}
            primaryValue={recommendedPreview.length}
            primaryUnit="suggestions"
            breakdown={
              recommendedPreview.length
                ? [{ label: "Top picks", value: recommendedPreview.join(", ").slice(0, 72) }]
                : []
            }
            action={{ href: "/assurance/scorecards", label: "Review scorecards" }}
            variant="compact"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {visibility.programEvolution ? (
          <Link className="ui-link" href="/assurance/program-evolution" prefetch={false}>
            Program evolution
          </Link>
        ) : null}
        {canViewAssuranceOps ? (
          <Link className="ui-link" href="/reports#assurance-analytics">
            Assurance analytics
          </Link>
        ) : null}
      </div>

      <details className="ui-soft-details text-xs text-[var(--text-secondary)]">
        <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Run deltas and diagnostics</summary>
        <p className="mt-2">
          {v6PriorAssuranceRun && v6LastAssuranceRun ? (
            <>
              Prior {String(v6PriorAssuranceRun.created_at ?? "").slice(0, 10)} to latest{" "}
              {String(v6LastAssuranceRun.created_at ?? "").slice(0, 10)}
              {v6LastAssuranceRun.risk_delta_json?.confidence_degradation
                ? " · confidence dropped."
                : " · no confidence drop flag."}
            </>
          ) : (
            "Need at least two runs for delta comparison."
          )}
        </p>
      </details>
    </section>
  );
}

export function DashboardOutcomeIntelligenceSection(props: {
  summary: OutcomeSummary;
  recentRows: OutcomeRow[];
}) {
  const { summary, recentRows } = props;
  const eff =
    summary.overallAvgEffectiveness !== null && summary.overallAvgEffectiveness !== undefined
      ? String(summary.overallAvgEffectiveness)
      : "—";
  const trend =
    summary.effectivenessTrendDelta !== null && summary.effectivenessTrendDelta !== undefined
      ? String(summary.effectivenessTrendDelta)
      : "—";

  return (
    <section className="space-y-4">
      <div>
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Outcomes
        </p>
        <h2 className="ui-section-title mt-2 text-xl">Intervention effectiveness</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OperationalSummaryCard
          eyebrow="Volume"
          headline="Analyses"
          tone="neutral"
          icon={BarChart3}
          primaryValue={summary.analysesCount}
          primaryUnit="completed analyses"
          action={{ href: "/reports#outcome-intelligence", label: "Review outcome reports" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Performance"
          headline="Avg effectiveness"
          tone="neutral"
          icon={TrendingUp}
          primaryValue={eff}
          primaryUnit="rolling aggregate"
          action={{
            href: "/api/outcomes/interventions?limit=15&offset=0",
            label: "Outcomes JSON",
            external: true,
          }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Trend"
          headline="Effectiveness delta"
          tone="neutral"
          icon={TrendingUp}
          primaryValue={trend}
          primaryUnit="vs prior window"
          action={{ href: "/reports#outcome-intelligence", label: "Review reports" }}
          variant="compact"
        />
      </div>
      {recentRows.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Recent interventions">
          {recentRows.slice(0, 4).map((row) => (
            <li
              key={row.id}
              className="ui-metric-chip inline-flex min-h-8 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface/80 px-2.5 py-1 text-[11px] dark:bg-[var(--text-primary)]/25"
            >
              <span className="font-medium text-[var(--text-tertiary)]">
                {row.intervention_type.replace(/_/g, " ")}
              </span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{row.effectiveness_score}</span>
              {row.recurrence_delta !== 0 ? (
                <span className="tabular-nums text-[var(--text-secondary)]">Δ {row.recurrence_delta}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link className="ui-link" href="/reports#outcome-intelligence">
          Review outcome reports
        </Link>
        <ApiJsonLink className="ui-link" href="/api/outcomes/interventions?limit=15&offset=0">
          Outcomes JSON
        </ApiJsonLink>
      </div>
    </section>
  );
}

export function DashboardAssuranceSignalsSection(props: {
  analytics: AssuranceAnalyticsSummary;
  visibility: Pick<AssuranceDashboardVisibility, "controlPolicies" | "playbooks" | "automationOps">;
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
                : "—"
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

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { DashboardV6AssuranceSnapshotSection as DashboardAssuranceSnapshotSection };
// End version-name compatibility aliases.
