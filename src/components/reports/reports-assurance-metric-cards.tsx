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
import type { AssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

function sumSeverity(a: Record<string, number>): number {
  return Object.values(a).reduce((s, n) => s + n, 0);
}

function playbookTone(a: AssuranceAnalyticsSummary): OperationalTone {
  return a.playbook_runs_last_30d.failed > 0 ? "attention" : "healthy";
}

function autopilotTone(a: AssuranceAnalyticsSummary): OperationalTone {
  return a.autopilot_logs_last_30d.blocked > 0 ? "attention" : "neutral";
}

function percentOrDash(value: number | null | undefined): string {
  return value != null ? `${(value * 100).toFixed(1)}%` : "—";
}

export function OverviewSummaryCards({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  const openSev = a.open_findings_by_severity;
  const openTotal = sumSeverity(openSev);
  const sevChips = Object.entries(openSev).map(([k, n]) => ({
    label: k,
    value: String(n),
  }));

  return (
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
        tone={playbookTone(a)}
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
        tone={autopilotTone(a)}
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
  );
}

export function DiagnosticSummaryCards({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  return (
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
        tone={playbookTone(a)}
        icon={PlayCircle}
        primaryValue={percentOrDash(a.playbook_success_rate_30d)}
        primaryUnit="completed vs failed"
        action={{ href: "/assurance/playbooks", label: "Review playbooks" }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="Autopilot"
        headline="Mutate success (30d)"
        tone="neutral"
        icon={Radio}
        primaryValue={percentOrDash(a.autopilot_mutate_success_rate_30d)}
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
  );
}

export function ExternalCollaborationCard({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  return (
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
        { label: "With deadline", value: String(a.external_links_with_workflow_deadline_30d) },
        {
          label: "Submissions / row",
          value:
            a.external_collaboration_submissions_per_link_row_30d != null
              ? a.external_collaboration_submissions_per_link_row_30d.toFixed(2)
              : "—",
        },
      ]}
      action={{ href: "/contracts/collaboration", label: "Review collaboration" }}
      variant="compact"
      className="mt-3"
    />
  );
}

export function AssuranceHubVisitorsCard({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  return (
    <OperationalSummaryCard
      eyebrow="Adoption"
      headline="Assurance hub visitors"
      tone="neutral"
      icon={Users}
      primaryValue={a.weekly_distinct_assurance_hub_visitors_rolling}
      primaryUnit="distinct users (7d)"
      action={{ href: "/assurance", label: "Inspect assurance hub" }}
      variant="compact"
      className="mt-3"
    />
  );
}
