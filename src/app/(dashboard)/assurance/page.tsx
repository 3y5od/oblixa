import Link from "next/link";
import {
  ClipboardList,
  GitBranch,
  ListOrdered,
  PlayCircle,
  Radio,
  Scale,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import {
  OperationalSurfaceLinkCard,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { getAuthContext } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { assertAnyV6PageFeature } from "@/lib/v6/feature-guards";
import { buildAssuranceAnalyticsSummary } from "@/lib/v6/assurance-analytics";
import type { OperationalTone } from "@/lib/ui/operational-surface";

const hubItems = [
  {
    href: "/assurance/findings",
    title: "Findings queue",
    hint: "Drift signals and escalations.",
    action: "Review findings",
    icon: ClipboardList,
  },
  {
    href: "/assurance/control-policies",
    title: "Control policies",
    hint: "Published machine-readable controls.",
    action: "Review policies",
    icon: ShieldCheck,
  },
  {
    href: "/assurance/scorecards",
    title: "Scorecards",
    hint: "Health by segment and team.",
    action: "Review scorecards",
    icon: Scale,
  },
  {
    href: "/assurance/health-graph",
    title: "Health graph",
    hint: "Concentration and propagation.",
    action: "Review graph",
    icon: Share2,
  },
  {
    href: "/assurance/review-boards",
    title: "Review boards",
    hint: "Recurring assurance packets.",
    action: "Review boards",
    icon: ListOrdered,
  },
  {
    href: "/assurance/playbooks",
    title: "Adaptive playbooks",
    hint: "Preview and execute interventions.",
    action: "Review playbooks",
    icon: PlayCircle,
  },
  {
    href: "/assurance/autopilot",
    title: "Autopilot",
    hint: "Bounded automation with audit trail.",
    action: "Review autopilot",
    icon: Radio,
  },
  {
    href: "/assurance/segments",
    title: "Segments",
    hint: "Portfolio hierarchy and rollups.",
    action: "View segments",
    icon: GitBranch,
  },
  {
    href: "/assurance/program-evolution",
    title: "Program evolution",
    hint: "Stage changes and measure impact.",
    action: "View evolution",
    icon: Sparkles,
  },
] as const;

export default async function AssurancePage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  assertAnyV6PageFeature([
    "v6AssuranceCore",
    "v6ControlPolicies",
    "v6AdaptivePlaybooks",
    "v6ReviewBoards",
    "v6Autopilot",
    "v6Segments",
  ]);

  const v6Core = isFeatureEnabled("v6AssuranceCore");
  const v6Outcomes = isFeatureEnabled("v6OutcomeIntelligence");
  const [{ data: hubSnapshot }, analytics] = await Promise.all([
    v6Core
      ? ctx.admin.rpc("assurance_hub_snapshot", { p_org_id: ctx.orgId })
      : Promise.resolve({ data: null }),
    v6Core ? buildAssuranceAnalyticsSummary(ctx.admin, ctx.orgId) : Promise.resolve(null),
  ]);
  const snapshot = hubSnapshot && typeof hubSnapshot === "object"
    ? hubSnapshot as Record<string, unknown>
    : {};
  const openFindings = Number(snapshot.openFindings) || 0;
  const lastRun = snapshot.lastRun && typeof snapshot.lastRun === "object"
    ? snapshot.lastRun as {
        check_type?: unknown;
        trigger_type?: unknown;
        completed_at?: unknown;
        watch_signals_json?: unknown;
        recommended_interventions_json?: unknown;
      }
    : null;

  const watch = Array.isArray(lastRun?.watch_signals_json) ? (lastRun!.watch_signals_json as string[]) : [];
  const rec = Array.isArray(lastRun?.recommended_interventions_json)
    ? (lastRun!.recommended_interventions_json as string[])
    : [];

  const open = openFindings;
  const findingsTone: OperationalTone = open > 0 ? "attention" : "healthy";
  const playbookTone: OperationalTone =
    analytics && analytics.playbook_runs_last_30d.failed > 0 ? "attention" : "healthy";

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header-compact">
        <div>
          <p className="ui-eyebrow">Assurance command center</p>
          <h1 className="ui-page-title-compact mt-2">Continuous assurance</h1>
          <p className="ui-page-lead mt-2 max-w-2xl">
            Detect drift, route interventions, and measure operational effect across the governed assurance surface.
          </p>
        </div>
      </header>
      {v6Core && analytics ? (
        <section className="ui-page-shell space-y-4">
          <div>
            <p className="ui-eyebrow">Activity</p>
            <h2 className="ui-page-title mt-2 text-[1.8rem]">Assurance metrics</h2>
            <p className="ui-section-lead mt-2">Keep finding pressure, policy pass rate, automation performance, and the latest assurance run visible before you dive into detailed diagnostics.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <OperationalSummaryCard
              eyebrow="Queue"
              headline="Open findings"
              tone={findingsTone}
              icon={ClipboardList}
              primaryValue={open}
              primaryUnit="open / in review"
              breakdown={[
                { label: "Recurrence types", value: String(analytics.open_finding_type_recurrence_count) },
              ]}
              action={{ href: "/assurance/findings", label: "Review findings" }}
              variant="compact"
            />
            <OperationalSummaryCard
              eyebrow="Policies"
              headline="Pass rate"
              tone="neutral"
              icon={ShieldCheck}
              primaryValue={`${(analytics.policy_pass_rate * 100).toFixed(1)}%`}
              primaryUnit="policy evaluations"
              breakdown={[{ label: "Units", value: String(analytics.policy_evaluation_units) }]}
              action={{ href: "/assurance/control-policies", label: "Review policies" }}
              variant="compact"
            />
            <OperationalSummaryCard
              eyebrow="Automation"
              headline="Playbooks (30d)"
              tone={playbookTone}
              icon={PlayCircle}
              primaryValue={analytics.playbook_runs_last_30d.completed}
              primaryUnit="completed runs"
              breakdown={[{ label: "Failed", value: String(analytics.playbook_runs_last_30d.failed) }]}
              action={{ href: "/assurance/playbooks", label: "Review playbooks" }}
              variant="compact"
            />
          </div>
          {lastRun ? (
            <div className="flex flex-wrap gap-2 text-[12px] text-[var(--text-secondary)]">
              <span className="ui-metric-chip inline-flex min-h-8 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface/90 px-2.5 py-1 dark:bg-[var(--text-primary)]/25">
                <span className="font-medium text-[var(--text-tertiary)]">Last check</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {String(lastRun.check_type)} · {String(lastRun.trigger_type)}
                  {lastRun.completed_at ? ` · ${String(lastRun.completed_at).slice(0, 10)}` : ""}
                </span>
              </span>
              {watch.length ? (
                <span className="ui-metric-chip inline-flex min-h-8 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface/90 px-2.5 py-1 dark:bg-[var(--text-primary)]/25">
                  <span className="font-medium text-[var(--text-tertiary)]">Signals</span>
                  <span className="max-w-[14rem] truncate font-semibold text-[var(--text-primary)]">
                    {watch.slice(0, 3).join(", ")}
                  </span>
                </span>
              ) : null}
              {rec.length ? (
                <span className="ui-metric-chip inline-flex min-h-8 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface/90 px-2.5 py-1 dark:bg-[var(--text-primary)]/25">
                  <span className="font-medium text-[var(--text-tertiary)]">Next</span>
                  <span className="max-w-[14rem] truncate font-semibold text-[var(--text-primary)]">
                    {rec.slice(0, 2).join(", ")}
                  </span>
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">No assurance check runs recorded yet.</p>
          )}
          <p className="flex flex-wrap gap-2 text-xs">
            <Link className="ui-link" href="/assurance/findings">
              Findings queue
            </Link>
            <Link className="ui-link" href="/api/assurance/check-runs?limit=40" target="_blank" rel="noreferrer">
              Check runs JSON
            </Link>
            <Link className="ui-link" href="/api/assurance/analytics/summary" target="_blank" rel="noreferrer">
              Analytics JSON
            </Link>
            {v6Outcomes ? (
              <>
                <Link className="ui-link" href="/reports#outcome-intelligence">
                  Outcome intelligence
                </Link>
                <Link className="ui-link" href="/api/outcomes/interventions?limit=20&offset=0" target="_blank" rel="noreferrer">
                  Outcomes JSON
                </Link>
              </>
            ) : null}
          </p>
          <details className="ui-soft-details text-xs text-[var(--text-secondary)]">
            <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Diagnostics</summary>
            <ul className="ui-compact-list mt-2">
              <li className="ui-compact-list-item">
                Incremental runs (30d):{" "}
                <span className="tabular-nums">{analytics.incremental_assurance_runs_last_30d}</span>
              </li>
              <li className="ui-compact-list-item">
                Review boards (30d): <span className="tabular-nums">{analytics.review_board_runs_last_30d}</span>
              </li>
              <li className="ui-compact-list-item">
                Autopilot blocked/failed/reverted: {analytics.autopilot_blocked_and_failed_30d.blocked}/
                {analytics.autopilot_blocked_and_failed_30d.failed}/{analytics.autopilot_blocked_and_failed_30d.reverted}
              </li>
              <li className="ui-compact-list-item">
                External yield:{" "}
                {analytics.external_collaboration_submissions_per_link_created_30d != null
                  ? analytics.external_collaboration_submissions_per_link_created_30d.toFixed(2)
                  : "—"}
              </li>
              <li className="ui-compact-list-item">
                Open finding median age:{" "}
                {analytics.median_age_hours_open_findings != null
                  ? `${analytics.median_age_hours_open_findings}h`
                  : "—"}
              </li>
            </ul>
          </details>
        </section>
      ) : null}
      <div>
        <p className="ui-eyebrow">Navigate</p>
        <h2 className="ui-page-title mt-2 text-[1.8rem]">Assurance areas</h2>
        <div className="ui-summary-grid mt-3">
          {hubItems.map((item) => (
            <OperationalSurfaceLinkCard
              key={item.href}
              href={item.href}
              eyebrow="Area"
              title={item.title}
              hint={item.hint}
              icon={item.icon}
              tone="neutral"
              actionLabel={item.action}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
