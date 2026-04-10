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
import {
  OperationalMetricChip,
  OperationalSectionHeader,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/v5/capacity-forecast-keys";
import type { V5SignalQualityDisplayRow } from "@/lib/v5/v5-signal-quality-labels";
import type { OutcomeInterventionRow } from "@/lib/v6/outcomes";
import type { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/v6/outcomes";

type SignalQualityRow = V5SignalQualityDisplayRow;
type OutcomeIntelResult = Awaited<ReturnType<typeof computeOutcomeViews>>;
type OutcomeDrilldownResult = Awaited<ReturnType<typeof listOutcomeInterventionsPaginated>>;

type PortfolioProgramRow = { program_id: string; active_assignments: number };
type PortfolioCounterpartyRow = { counterparty_key: string; open_exceptions: number };

export function ReportsPortfolioAnalyticsSection(props: {
  portfolioByProgram: { programs: PortfolioProgramRow[]; error: string | null };
  portfolioByCounterparty: { counterparties: PortfolioCounterpartyRow[]; error: string | null };
}) {
  const { portfolioByProgram, portfolioByCounterparty } = props;
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
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
            <table className="min-w-full text-left text-sm text-zinc-700">
              <thead className="bg-zinc-50/80 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Program</th>
                  <th className="px-3 py-2">Active assignments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(portfolioByProgram.programs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-zinc-500">
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
          <Link href="/api/intelligence/portfolio-by-program" className="ui-link mt-3 inline-block text-xs" target="_blank" rel="noreferrer">
            View JSON
          </Link>
        </article>
        <article className="ui-card p-5" id="portfolio-by-counterparty">
          <p className="ui-eyebrow">Counterparties</p>
          <h3 className="ui-section-title mt-1 text-base">Open exceptions by counterparty</h3>
          <p className="ui-muted-tight mt-1">Contracts with exceptions, grouped by counterparty key.</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-100">
            <table className="min-w-full text-left text-sm text-zinc-700">
              <thead className="bg-zinc-50/80 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Counterparty</th>
                  <th className="px-3 py-2">Open / in progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(portfolioByCounterparty.counterparties ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-zinc-500">
                      No matching exceptions.
                    </td>
                  </tr>
                ) : (
                  (portfolioByCounterparty.counterparties ?? []).map((c) => (
                    <tr key={c.counterparty_key}>
                      <td className="px-3 py-2">
                        <Link
                          href={`/counterparties/${encodeURIComponent(c.counterparty_key)}`}
                          className="ui-link font-mono text-xs"
                        >
                          {c.counterparty_key}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{c.open_exceptions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link
            href="/api/intelligence/portfolio-by-counterparty"
            className="ui-link mt-3 inline-block text-xs"
            target="_blank"
            rel="noreferrer"
          >
            View JSON
          </Link>
        </article>
      </div>
      <details className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 text-xs text-zinc-600">
        <summary className="cursor-pointer font-medium text-zinc-800">Raw analytics payloads</summary>
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-surface p-3 font-mono text-[11px] text-zinc-700">
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
          ...(deltaStalledDecisions !== null
            ? [
                {
                  label: "Δ stalled decisions",
                  value: deltaStalledDecisions > 0 ? `+${deltaStalledDecisions}` : String(deltaStalledDecisions),
                },
              ]
            : []),
        ]}
        action={{ href: "/api/capacity/forecast", label: "Forecast JSON", external: true }}
        variant="compact"
        footerExtra={
          <div className="mt-3 space-y-2 text-[11px] text-zinc-600">
            {simOn ? (
              <p>
                Tie to{" "}
                <Link href="/reports#portfolio-signals" className="ui-link">
                  portfolio signals
                </Link>{" "}
                before rebalancing ownership.
              </p>
            ) : null}
            <ul className="space-y-1.5 text-zinc-700">
              {(forecasts ?? []).map((f) => {
                const fj = f.forecast_json as Record<string, unknown> | null;
                return (
                  <li key={f.id}>
                    Horizon {f.forecast_horizon_days}d · {new Date(f.generated_at).toLocaleString()}
                    {fj && typeof fj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] === "number" ? (
                      <span className="ml-1 text-zinc-500">
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
              {(forecasts ?? []).length === 0 ? <li className="text-zinc-500">No forecasts available.</li> : null}
            </ul>
          </div>
        }
      />

      <article className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-4 shadow-[var(--shadow-1)]">
        <OperationalSectionHeader
          eyebrow="Planning"
          title="Reassignment planner"
          description="Model delegation, then apply updates in campaigns and decisions."
        />
        <form className="mt-4 grid gap-2" action="/api/capacity/reassignment-plan" method="post" target="_blank">
          <label className="text-xs text-zinc-600">
            Team key
            <input name="teamKey" className="ui-input-compact mt-1 w-full" defaultValue="ops" required />
          </label>
          <label className="text-xs text-zinc-600">
            Current load
            <input
              name="currentLoad"
              type="number"
              className="ui-input-compact mt-1 w-full"
              defaultValue={latestOpenTasks ?? 0}
              required
            />
          </label>
          <label className="text-xs text-zinc-600">
            Target load
            <input
              name="targetLoad"
              type="number"
              className="ui-input-compact mt-1 w-full"
              defaultValue={latestPendingApprovals ?? 0}
              required
            />
          </label>
          <button type="submit" className="ui-btn-secondary mt-2 px-3 py-2 text-xs">
            Generate reassignment plan
          </button>
        </form>
      </article>

      <article className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-4 shadow-[var(--shadow-1)]">
        <OperationalSectionHeader
          eyebrow="Workflow"
          title="Recommendations"
          description="Accept or dismiss grounded recommendations."
        />
        <ul className="mt-3 divide-y divide-zinc-100 text-sm text-zinc-700">
          {(recommendations ?? []).map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {r.recommendation_type} · {r.priority} ·{" "}
                  {r.accepted ? "accepted" : r.dismissed ? "dismissed" : "pending"}
                </span>
                {simOn ? (
                  <RecommendationRowActions
                    recommendationId={r.id}
                    accepted={!!r.accepted}
                    dismissed={!!r.dismissed}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {(recommendations ?? []).length === 0 ? <li className="py-2 text-zinc-500">No recommendations.</li> : null}
        </ul>
        <Link href="/api/intelligence/recommendations" className="ui-link mt-3 inline-block text-xs" target="_blank" rel="noreferrer">
          Recommendations JSON
        </Link>
      </article>

      <OperationalSummaryCard
        eyebrow="Rollout"
        headline="Campaign drift"
        tone={(activeCampaigns ?? []).length > 0 ? "neutral" : "healthy"}
        icon={Megaphone}
        primaryValue={(activeCampaigns ?? []).length}
        primaryUnit="active / paused"
        action={{ href: "/campaigns", label: "Open campaign center" }}
        variant="compact"
        id="campaign-drift"
        footerExtra={
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {(activeCampaigns ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/campaigns/${c.id}`} className="ui-link">
                  {c.name}
                </Link>{" "}
                <span className="text-zinc-500">· {c.status}</span>
              </li>
            ))}
            {(activeCampaigns ?? []).length === 0 ? <li className="text-zinc-500">No active campaigns.</li> : null}
          </ul>
        }
      />
    </section>
  );
}

export function ReportsV5SignalQualitySection(props: {
  metricsDate: string;
  rows: SignalQualityRow[];
  rawJson: unknown;
}) {
  return (
    <section className="ui-card scroll-mt-8 p-5" id="v5-success-metrics">
      <OperationalSectionHeader
        eyebrow="Telemetry"
        title="V5 success metrics"
        description="Counters merged into org_behavior_metrics.v5_signal_quality_json."
        actions={<span className="text-xs text-zinc-600">As of {props.metricsDate}</span>}
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
            breakdown={[{ label: "Key", value: row.key }]}
            showStatusBadge={false}
            action={{ href: "/reports#v5-success-metrics", label: "View on page" }}
            variant="compact"
          />
        ))}
      </div>
      {props.rows.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No numeric counters recorded yet.</p> : null}
      <details className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 text-xs text-zinc-600">
        <summary className="cursor-pointer font-medium text-zinc-800">Raw JSON</summary>
        <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-surface p-3 font-mono text-[11px] text-zinc-700">
          {JSON.stringify(props.rawJson ?? {}, null, 2)}
        </pre>
      </details>
    </section>
  );
}

export function ReportsOutcomeIntelligenceSection(props: {
  outcomeIntel: OutcomeIntelResult | null;
  outcomeDrilldown: OutcomeDrilldownResult | null;
  canViewAssuranceOps: boolean;
}) {
  const { outcomeIntel, outcomeDrilldown, canViewAssuranceOps } = props;

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
            <p className="col-span-full text-sm text-zinc-500">
              Operator-only breakdowns are hidden for your role.
            </p>
          )}
        </div>
      ) : null}
      {outcomeIntel && !outcomeIntel.error && outcomeIntel.summary ? (
        <div className="mt-4 rounded-2xl border border-zinc-200/90 bg-surface/90 p-4 text-sm text-zinc-700 dark:bg-zinc-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Portfolio summary</p>
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
        <div className="mt-4 rounded-2xl border border-zinc-200/90 bg-surface/90 p-4 dark:bg-zinc-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Effectiveness by month
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            {(outcomeIntel.weeklyEffectiveness ?? []).map((row) => (
              <li key={row.week}>
                {row.week}: avg {row.avgScore}{" "}
                <span className="text-zinc-500">({row.count} records)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {outcomeDrilldown && outcomeDrilldown.rows.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-zinc-200/90 bg-surface/90 p-4 dark:bg-zinc-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Recent analyses</p>
          <ul className="mt-2 space-y-2 text-xs text-zinc-700">
            {outcomeDrilldown.rows.map((row: OutcomeInterventionRow) => (
              <li key={row.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-2 py-1.5 dark:bg-zinc-900/30">
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
                <span className="mt-1 block text-[11px] text-zinc-500">
                  {row.source_playbook_run_id ? (
                    <Link className="ui-link" href="/assurance/playbooks">
                      Playbook run {row.source_playbook_run_id.slice(0, 8)}…
                    </Link>
                  ) : null}
                  {row.source_campaign_id ? (
                    <>
                      {row.source_playbook_run_id ? " · " : null}
                      <Link className="ui-link" href="/campaigns">
                        Campaign {row.source_campaign_id.slice(0, 8)}…
                      </Link>
                    </>
                  ) : null}
                  {row.source_control_policy_id ? (
                    <>
                      {row.source_playbook_run_id || row.source_campaign_id ? " · " : null}
                      <Link className="ui-link" href={`/assurance/control-policies/${row.source_control_policy_id}`}>
                        Control policy
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">
            <Link className="ui-link" href="/api/outcomes/interventions?limit=20&offset=0" target="_blank" rel="noreferrer">
              Paginated API
            </Link>
          </p>
        </div>
      ) : null}
      {(!outcomeIntel || outcomeIntel.error) && (
        <p className="mt-3 text-sm text-zinc-500">Loading outcome data failed or feature is off.</p>
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
          action={{ href: "/api/outcomes/interventions", label: "Open interventions", external: true }}
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
          action={{ href: "/api/outcomes/program-effectiveness", label: "Open program outcomes", external: true }}
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
          action={{ href: "/api/outcomes/control-effectiveness", label: "Open control outcomes", external: true }}
          variant="compact"
        />
      </div>
    </section>
  );
}
