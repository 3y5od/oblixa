import Link from "next/link";
import {
  Activity,
  BarChart3,
  ClipboardList,
  Database,
  LineChart,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { RecommendationRowActions } from "@/components/reports/recommendation-row-actions";
import { OutcomeEffectivenessBreakdown } from "@/components/reports/outcome-effectiveness-breakdown";
import { CapacityReassignmentPlannerForm } from "@/components/reports/capacity-reassignment-planner-form";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import {
  OperationalMetricChip,
  OperationalSectionHeader,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/decision-intelligence/capacity-forecast-keys";
import type { SignalQualityDisplayRow } from "@/lib/decision-intelligence/signal-quality-labels";
import type { OutcomeInterventionRow } from "@/lib/assurance/outcomes";
import type { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/assurance/outcomes";

type SignalQualityRow = SignalQualityDisplayRow;
type OutcomeIntelResult = Awaited<ReturnType<typeof computeOutcomeViews>>;
type OutcomeDrilldownResult = Awaited<ReturnType<typeof listOutcomeInterventionsPaginated>>;

type PortfolioProgramRow = { program_id: string; active_assignments: number };
type PortfolioCounterpartyRow = { counterparty_key: string; open_exceptions: number };

export function ReportsPortfolioAnalyticsSection(props: {
  portfolioByProgram: { programs: PortfolioProgramRow[]; error: string | null };
  portfolioByCounterparty: { counterparties: PortfolioCounterpartyRow[]; error: string | null };
  relationshipsVisible: boolean;
}) {
  const { portfolioByProgram, portfolioByCounterparty, relationshipsVisible } = props;
  return (
    <section id="portfolio-analytics" className="scroll-mt-8 space-y-4">
      <OperationalSectionHeader
        eyebrow="Portfolio"
        title="Portfolio analytics"
        description="Workload by active program assignment and open exception concentration by counterparty."
      />
      {portfolioByProgram.error ? <p className="ui-alert-error">Program analytics: {portfolioByProgram.error}</p> : null}
      {portfolioByCounterparty.error ? (
        <p className="ui-alert-error">Counterparty analytics: {portfolioByCounterparty.error}</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="ui-card p-5" id="portfolio-by-program">
          <p className="ui-eyebrow">Programs</p>
          <h3 className="ui-section-title mt-1 text-base">Contracts by program</h3>
          <p className="ui-muted-tight mt-1">Active assignment row counts per program.</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="min-w-full text-left text-sm text-[var(--text-secondary)]">
              <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-3 py-2">Program</th>
                  <th className="px-3 py-2">Active assignments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {(portfolioByProgram.programs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-[var(--text-tertiary)]">
                      No active program assignments.
                    </td>
                  </tr>
                ) : (
                  (portfolioByProgram.programs ?? []).map((p) => (
                    <tr key={p.program_id}>
                      <td className="px-3 py-2 font-mono text-xs">{p.program_id}</td>
                      <td className="px-3 py-2">{p.active_assignments}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ApiJsonLink href="/api/intelligence/portfolio-by-program" className="ui-link mt-3 inline-block text-xs">
            View JSON
          </ApiJsonLink>
        </article>
        <article className="ui-card p-5" id="portfolio-by-counterparty">
          <p className="ui-eyebrow">Counterparties</p>
          <h3 className="ui-section-title mt-1 text-base">Active exceptions by counterparty</h3>
          <p className="ui-muted-tight mt-1">Contracts with exceptions, grouped by counterparty key.</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="min-w-full text-left text-sm text-[var(--text-secondary)]">
              <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-3 py-2">Counterparty</th>
                  <th className="px-3 py-2">Open / in progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {(portfolioByCounterparty.counterparties ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-[var(--text-tertiary)]">
                      No matching exceptions.
                    </td>
                  </tr>
                ) : (
                  (portfolioByCounterparty.counterparties ?? []).map((c) => (
                    <tr key={c.counterparty_key}>
                      <td className="px-3 py-2">
                        {relationshipsVisible ? (
                          <Link
                            href={`/counterparties/${encodeURIComponent(c.counterparty_key)}`}
                            className="ui-link font-mono text-xs"
                          >
                            {c.counterparty_key}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{c.counterparty_key}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{c.open_exceptions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ApiJsonLink
            href="/api/intelligence/portfolio-by-counterparty"
            className="ui-link mt-3 inline-block text-xs"
          >
            View JSON
          </ApiJsonLink>
        </article>
      </div>
      <details className="ui-soft-details p-4 text-xs text-[var(--text-secondary)]">
        <summary className="cursor-pointer font-medium text-[var(--text-primary)]">Raw analytics payloads</summary>
        <pre className="ui-soft-details mt-3 max-h-64 overflow-auto p-3 font-mono text-[11px] text-[var(--text-secondary)]">
          {JSON.stringify(
            {
              programs: portfolioByProgram.programs,
              counterparties: portfolioByCounterparty.counterparties,
            },
            null,
            2
          )}
        </pre>
      </details>
    </section>
  );
}

type ForecastRow = {
  id: string;
  forecast_horizon_days: number | null;
  forecast_json: unknown;
  generated_at: string;
};

export function ReportsCapacityCampaignsSection(props: {
  simOn: boolean;
  forecasts: ForecastRow[] | null | undefined;
  recommendations: Array<{
    id: string;
    recommendation_type: string;
    priority: string;
    accepted: boolean | null;
    dismissed: boolean | null;
  }> | null | undefined;
  activeCampaigns: Array<{ id: string; name: string; status: string }> | null | undefined;
  deltaTasks: number | null;
  deltaStalledDecisions: number | null;
  latestOpenTasks: number | null;
  latestPendingApprovals: number | null;
  showCampaignSurfaces: boolean;
  showDecisionSignals: boolean;
  showAnalyticsLinks: boolean;
}) {
  const {
    simOn,
    forecasts,
    recommendations,
    activeCampaigns,
    deltaTasks,
    deltaStalledDecisions,
    latestOpenTasks,
    latestPendingApprovals,
    showCampaignSurfaces,
    showDecisionSignals,
    showAnalyticsLinks,
  } = props;

  return (
    <section id="capacity-forecasts" className="grid scroll-mt-8 gap-4 lg:grid-cols-3">
      <OperationalSummaryCard
        eyebrow="Capacity"
        headline="Forecasts"
        tone="neutral"
        icon={LineChart}
        primaryValue={(forecasts ?? []).length}
        primaryUnit="recent runs"
        breakdown={[
          ...(deltaTasks !== null
            ? [{ label: "Δ open tasks", value: deltaTasks > 0 ? `+${deltaTasks}` : String(deltaTasks) }]
            : []),
          ...(showDecisionSignals && deltaStalledDecisions !== null
            ? [
                {
                  label: "Δ stalled decisions",
                  value: deltaStalledDecisions > 0 ? `+${deltaStalledDecisions}` : String(deltaStalledDecisions),
                },
              ]
            : []),
        ]}
        action={
          showAnalyticsLinks
            ? { href: "/api/capacity/forecast", label: "Forecast JSON", external: true }
            : { href: "/reports#capacity-forecasts", label: "Forecast details" }
        }
        variant="compact"
        footerExtra={
          <div className="mt-3 space-y-2 text-[11px] text-[var(--text-secondary)]">
            {simOn && showAnalyticsLinks ? (
              <p>
                Tie to{" "}
                <Link href="/reports#portfolio-signals" className="ui-link">
                  portfolio signals
                </Link>{" "}
                before rebalancing ownership.
              </p>
            ) : null}
            <ul className="space-y-1.5 text-[var(--text-secondary)]">
              {(forecasts ?? []).map((f) => {
                const fj = f.forecast_json as Record<string, unknown> | null;
                return (
                  <li key={f.id}>
                    Horizon {f.forecast_horizon_days}d · {new Date(f.generated_at).toLocaleString()}
                    {fj && typeof fj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] === "number" ? (
                      <span className="ml-1 text-[var(--text-tertiary)]">
                        (tasks {String(fj[CAPACITY_FORECAST_JSON_KEYS.open_tasks])}, approvals{" "}
                        {String(fj[CAPACITY_FORECAST_JSON_KEYS.pending_approvals] ?? "—")}, decisions{" "}
                        {String(fj[CAPACITY_FORECAST_JSON_KEYS.open_decisions] ?? "—")}
                        {typeof fj[CAPACITY_FORECAST_JSON_KEYS.contracts_without_owner] === "number"
                          ? `, unassigned ${String(fj[CAPACITY_FORECAST_JSON_KEYS.contracts_without_owner])}`
                          : ""}
                        )
                      </span>
                    ) : null}
                  </li>
                );
              })}
              {(forecasts ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No forecasts available.</li> : null}
            </ul>
          </div>
        }
      />

      <article className="ui-card p-4">
        <OperationalSectionHeader
          eyebrow="Planning"
          title="Reassignment planner"
          description={
            showCampaignSurfaces || showDecisionSignals
              ? "Model delegation, then apply updates in campaigns and decisions."
              : "Model delegation and track operational workload shifts."
          }
        />
        <CapacityReassignmentPlannerForm
          defaultCurrentLoad={latestOpenTasks ?? 0}
          defaultTargetLoad={latestPendingApprovals ?? 0}
          enabled={showAnalyticsLinks}
        />
      </article>

      <article className="ui-card p-4">
        <OperationalSectionHeader
          eyebrow="Workflow"
          title="Recommendations"
          description="Accept or dismiss grounded recommendations."
        />
        <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
          {(recommendations ?? []).map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {r.recommendation_type} · {r.priority} ·{" "}
                  {r.accepted ? "accepted" : r.dismissed ? "dismissed" : "pending"}
                </span>
                {simOn && showAnalyticsLinks ? (
                  <RecommendationRowActions
                    recommendationId={r.id}
                    accepted={!!r.accepted}
                    dismissed={!!r.dismissed}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {(recommendations ?? []).length === 0 ? <li className="py-2 text-[var(--text-tertiary)]">No recommendations.</li> : null}
        </ul>
        {showAnalyticsLinks ? (
          <ApiJsonLink
            href="/api/intelligence/recommendations"
            className="ui-link mt-3 inline-block text-xs"
          >
            Recommendations JSON
          </ApiJsonLink>
        ) : null}
      </article>

      {showCampaignSurfaces ? (
        <OperationalSummaryCard
          eyebrow="Rollout"
          headline="Campaign drift"
          tone={(activeCampaigns ?? []).length > 0 ? "neutral" : "healthy"}
          icon={Megaphone}
          primaryValue={(activeCampaigns ?? []).length}
          primaryUnit="active / paused"
          action={{ href: "/campaigns", label: "Review campaign center" }}
          variant="compact"
          id="campaign-drift"
          footerExtra={
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
              {(activeCampaigns ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} prefetch={false} className="ui-link">
                    {c.name}
                  </Link>{" "}
                  <span className="text-[var(--text-tertiary)]">· {c.status}</span>
                </li>
              ))}
              {(activeCampaigns ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No active campaigns.</li> : null}
            </ul>
          }
        />
      ) : null}
    </section>
  );
}

export function ReportsV5SignalQualitySection(props: {
  metricsDate: string;
  rows: SignalQualityRow[];
}) {
  return (
    <section className="ui-card scroll-mt-8 p-5" id="success-metrics">
      <OperationalSectionHeader
        eyebrow="Telemetry"
        title="Success metrics"
        description="Operational counters that show completed work, recommendation activity, and automation throughput."
        actions={<span className="text-xs text-[var(--text-secondary)]">As of {props.metricsDate}</span>}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.rows.map((row) => (
          <OperationalSummaryCard
            key={row.key}
            eyebrow="Metric"
            headline={row.label}
            tone="neutral"
            icon={Activity}
            primaryValue={row.value}
            primaryUnit="count"
            showStatusBadge={false}
            action={{ href: "/reports#success-metrics", label: "Review success metrics" }}
            variant="compact"
          />
        ))}
      </div>
      {props.rows.length === 0 ? <p className="mt-3 text-sm text-[var(--text-tertiary)]">No numeric counters recorded yet.</p> : null}
    </section>
  );
}

export function ReportsOutcomeIntelligenceSection(props: {
  outcomeIntel: OutcomeIntelResult | null;
  outcomeDrilldown: OutcomeDrilldownResult | null;
  canViewAssuranceOps: boolean;
  visibility: {
    campaigns: boolean;
    playbooks: boolean;
    controlPolicies: boolean;
  };
}) {
  const { outcomeIntel, outcomeDrilldown, canViewAssuranceOps, visibility } = props;

  return (
    <section className="ui-card scroll-mt-8 p-5" id="outcome-intelligence">
      <OperationalSectionHeader
        eyebrow="Outcomes"
        title="Outcome intelligence"
        description="Intervention effectiveness, recurrence, and links to source runs."
      />
      {outcomeIntel && !outcomeIntel.error ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OperationalSummaryCard
            eyebrow="Volume"
            headline="Recorded interventions"
            tone="neutral"
            icon={Database}
            primaryValue={outcomeIntel.interventions.length}
            primaryUnit="rows"
            action={{ href: "/api/outcomes/interventions?limit=20&offset=0", label: "Interventions JSON", external: true }}
            variant="compact"
          />
          {canViewAssuranceOps ? (
            <>
              <OutcomeEffectivenessBreakdown
                title="Program effectiveness (avg score by intervention type)"
                data={outcomeIntel.programEffectiveness}
              />
              <OutcomeEffectivenessBreakdown
                title="Control effectiveness (avg score by intervention type)"
                data={outcomeIntel.controlEffectiveness}
              />
              <OutcomeEffectivenessBreakdown
                title="Playbook effectiveness (avg score by intervention type)"
                data={outcomeIntel.playbookEffectiveness ?? {}}
              />
            </>
          ) : (
            <p className="col-span-full text-sm text-[var(--text-tertiary)]">
              Operator-only breakdowns are hidden for your role.
            </p>
          )}
        </div>
      ) : null}
      {outcomeIntel && !outcomeIntel.error && outcomeIntel.summary ? (
        <div className="ui-support-panel mt-4 p-4 text-sm text-[var(--text-secondary)] dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Portfolio summary</p>
          <div className="mt-2 flex flex-wrap gap-2" role="list">
            <OperationalMetricChip
              label="Avg effectiveness"
              value={String(outcomeIntel.summary.overallAvgEffectiveness ?? "—")}
            />
            {outcomeIntel.summary.effectivenessTrendDelta != null ? (
              <OperationalMetricChip
                label="Trend delta"
                value={String(outcomeIntel.summary.effectivenessTrendDelta)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {outcomeIntel && !outcomeIntel.error && (outcomeIntel.weeklyEffectiveness?.length ?? 0) > 0 ? (
        <div className="ui-support-panel mt-4 p-4 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Effectiveness by month
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
            {(outcomeIntel.weeklyEffectiveness ?? []).map((row) => (
              <li key={row.week}>
                {row.week}: avg {row.avgScore}{" "}
                <span className="text-[var(--text-tertiary)]">({row.count} records)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {outcomeDrilldown && outcomeDrilldown.rows.length > 0 ? (
        <div className="ui-support-panel mt-4 p-4 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Recent analyses</p>
          <ul className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
            {outcomeDrilldown.rows.map((row: OutcomeInterventionRow) => (
              <li key={row.id} className="ui-soft-details px-2 py-1.5 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
                <span className="font-medium">{row.intervention_type.replace(/_/g, " ")}</span>
                <div className="mt-1 flex flex-wrap gap-2" role="list">
                  <OperationalMetricChip label="Effectiveness" value={String(row.effectiveness_score)} />
                  {row.recurrence_delta !== 0 ? (
                    <OperationalMetricChip label="Recurrence Δ" value={String(row.recurrence_delta)} />
                  ) : null}
                  {row.time_to_stability_hours != null ? (
                    <OperationalMetricChip label="Time-to-close (h)" value={String(row.time_to_stability_hours)} />
                  ) : null}
                </div>
                <span className="mt-1 block text-[11px] text-[var(--text-tertiary)]">
                  {visibility.playbooks && row.source_playbook_run_id ? (
                    <Link className="ui-link" href="/assurance/playbooks" prefetch={false}>
                      Playbook run {row.source_playbook_run_id.slice(0, 8)}…
                    </Link>
                  ) : null}
                  {visibility.campaigns && row.source_campaign_id ? (
                    <>
                      {visibility.playbooks && row.source_playbook_run_id ? " · " : null}
                      <Link className="ui-link" href="/campaigns" prefetch={false}>
                        Campaign {row.source_campaign_id.slice(0, 8)}…
                      </Link>
                    </>
                  ) : null}
                  {visibility.controlPolicies && row.source_control_policy_id ? (
                    <>
                      {(visibility.playbooks && row.source_playbook_run_id) ||
                      (visibility.campaigns && row.source_campaign_id)
                        ? " · "
                        : null}
                      <Link
                      className="ui-link"
                      prefetch={false}
                      href={`/assurance/control-policies/${row.source_control_policy_id}`}
                    >
                        Control policy
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            <ApiJsonLink className="ui-link" href="/api/outcomes/interventions?limit=20&offset=0">
              Paginated API
            </ApiJsonLink>
          </p>
        </div>
      ) : null}
      {(!outcomeIntel || outcomeIntel.error) && (
        <p className="mt-3 text-sm text-[var(--text-tertiary)]">Loading outcome data failed or feature is off.</p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <OperationalSummaryCard
          eyebrow="API"
          headline="Interventions"
          tone="neutral"
          icon={Sparkles}
          primaryValue={null}
          primaryFallback="JSON"
          primaryUnit="endpoint"
          showStatusBadge={false}
          action={{ href: "/api/outcomes/interventions", label: "Inspect interventions", external: true }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="API"
          headline="Program effectiveness"
          tone="neutral"
          icon={BarChart3}
          primaryValue={null}
          primaryFallback="JSON"
          primaryUnit="endpoint"
          showStatusBadge={false}
          action={{ href: "/api/outcomes/program-effectiveness", label: "Inspect program outcomes", external: true }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="API"
          headline="Control effectiveness"
          tone="neutral"
          icon={ClipboardList}
          primaryValue={null}
          primaryFallback="JSON"
          primaryUnit="endpoint"
          showStatusBadge={false}
          action={{ href: "/api/outcomes/control-effectiveness", label: "Inspect control outcomes", external: true }}
          variant="compact"
        />
      </div>
    </section>
  );
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { ReportsV5SignalQualitySection as ReportsSignalQualitySection };
// End version-name compatibility aliases.
