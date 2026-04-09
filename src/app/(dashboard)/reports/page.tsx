import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { assertAnyV5PageFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { RecommendationRowActions } from "@/components/reports/recommendation-row-actions";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/v5/capacity-forecast-keys";
import {
  getPortfolioByCounterpartyRows,
  getPortfolioByProgramRows,
} from "@/lib/v5/portfolio-analytics";
import { buildPortfolioSignalSummary } from "@/lib/v5/portfolio-signal-summary";
import { parseV5SignalQualityForDisplay } from "@/lib/v5/v5-signal-quality-labels";

export default async function ReportsControlRoomPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertAnyV5PageFeature(["v5ControlRoomUx", "v5SimulationAndIntelligence"]);
  const { admin, orgId, role } = ctx;
  const simOn = isFeatureEnabled("v5SimulationAndIntelligence");
  const canViewV5Telemetry =
    role === "admin" || role === "manager" || role === "ops_manager";

  const [{ data: forecasts }, { data: capacitySnapshots }, { data: recommendations }, { data: activeCampaigns }] =
    await Promise.all([
      admin
        .from("capacity_forecasts")
        .select("id, forecast_horizon_days, forecast_json, generated_at, model_version")
        .eq("organization_id", orgId)
        .order("generated_at", { ascending: false })
        .limit(5),
      admin
        .from("capacity_snapshots")
        .select("id, snapshot_date, by_role_json, by_program_json")
        .eq("organization_id", orgId)
        .order("snapshot_date", { ascending: false })
        .limit(5),
      admin
        .from("operational_recommendations")
        .select("id, recommendation_type, priority, generated_at, accepted, dismissed")
        .eq("organization_id", orgId)
        .order("generated_at", { ascending: false })
        .limit(8),
      admin
        .from("portfolio_campaigns")
        .select("id, name, status, updated_at")
        .eq("organization_id", orgId)
        .in("status", ["active", "paused"])
        .order("updated_at", { ascending: false })
        .limit(8),
    ]);

  const [portfolioByProgram, portfolioByCounterparty] = simOn
    ? await Promise.all([
        getPortfolioByProgramRows(admin, orgId),
        getPortfolioByCounterpartyRows(admin, orgId),
      ])
    : [
        { programs: [], error: null as string | null },
        { counterparties: [], error: null as string | null },
      ];

  let signalQualityDebug: {
    metrics_date: string;
    v5_signal_quality_json: unknown;
  } | null = null;
  if (simOn && canViewV5Telemetry) {
    const { data } = await admin
      .from("org_behavior_metrics")
      .select("metrics_date, v5_signal_quality_json")
      .eq("organization_id", orgId)
      .order("metrics_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    signalQualityDebug = data ?? null;
  }

  const signalQualityRows = signalQualityDebug
    ? parseV5SignalQualityForDisplay(signalQualityDebug.v5_signal_quality_json)
    : [];

  const signalSummary = simOn ? (await buildPortfolioSignalSummary(admin, orgId)).signalSummary : [];

  const latestForecast = forecasts?.[0];
  const previousForecast = forecasts?.[1];
  const latestFj = latestForecast?.forecast_json as Record<string, unknown> | undefined;
  const prevFj = previousForecast?.forecast_json as Record<string, unknown> | undefined;
  const openTasksKey = CAPACITY_FORECAST_JSON_KEYS.open_tasks;
  const deltaTasks =
    latestFj &&
    prevFj &&
    typeof latestFj[openTasksKey] === "number" &&
    typeof prevFj[openTasksKey] === "number"
      ? (latestFj[openTasksKey] as number) - (prevFj[openTasksKey] as number)
      : null;
  const latestSnap = capacitySnapshots?.[0];
  const prevSnap = capacitySnapshots?.[1];
  const latestByProgram = latestSnap?.by_program_json as Record<string, unknown> | undefined;
  const prevByProgram = prevSnap?.by_program_json as Record<string, unknown> | undefined;
  const deltaStalledDecisions =
    latestByProgram &&
    prevByProgram &&
    typeof latestByProgram.stalled_decision_risk === "number" &&
    typeof prevByProgram.stalled_decision_risk === "number"
      ? (latestByProgram.stalled_decision_risk as number) - (prevByProgram.stalled_decision_risk as number)
      : null;
  const latestOpenTasks =
    latestFj && typeof latestFj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] === "number"
      ? (latestFj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] as number)
      : null;
  const latestPendingApprovals =
    latestFj && typeof latestFj[CAPACITY_FORECAST_JSON_KEYS.pending_approvals] === "number"
      ? (latestFj[CAPACITY_FORECAST_JSON_KEYS.pending_approvals] as number)
      : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Control-room reports</p>
          <h1 className="ui-display-title mt-2">Reports and intelligence</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Review portfolio risk, capacity forecasts, campaign drift, and recommendation quality in one place.
          </p>
        </div>
        <Link href="/contracts/reports" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          Open report packs
        </Link>
      </header>

      {simOn ? (
        <section id="portfolio-signals" className="scroll-mt-8">
          <h2 className="ui-section-title text-lg">Portfolio signals</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Grounded counts from execution data (same rows as{" "}
            <code className="rounded bg-zinc-100 px-1">GET /api/intelligence/portfolio-signals</code>).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {signalSummary.map((s) => (
              <article key={s.key} className="ui-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">{s.value}</p>
                <p className="mt-1 text-xs text-zinc-500">Severity: {s.severity}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">
          Enable simulation and intelligence (<code className="rounded bg-zinc-100 px-1">ENABLE_V5_SIMULATION_AND_INTELLIGENCE</code>)
          to load portfolio signal cards here.
        </p>
      )}

      {simOn ? (
        <section id="portfolio-analytics" className="scroll-mt-8 space-y-6">
          <h2 className="ui-section-title text-lg">Portfolio analytics</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Workload by active program assignment and open exception concentration by counterparty (same logic as{" "}
            <code className="rounded bg-zinc-100 px-1">/api/intelligence/portfolio-by-program</code> and{" "}
            <code className="rounded bg-zinc-100 px-1">portfolio-by-counterparty</code>).
          </p>
          {portfolioByProgram.error ? (
            <p className="text-sm text-rose-700">Program analytics: {portfolioByProgram.error}</p>
          ) : null}
          {portfolioByCounterparty.error ? (
            <p className="text-sm text-rose-700">Counterparty analytics: {portfolioByCounterparty.error}</p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="ui-card p-5" id="portfolio-by-program">
              <p className="ui-label-caps">Contracts by program</p>
              <p className="mt-1 text-xs text-zinc-500">Active assignment row counts per program.</p>
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
              <Link
                href="/api/intelligence/portfolio-by-program"
                className="ui-link mt-3 inline-block text-xs"
                target="_blank"
              >
                Open JSON API
              </Link>
            </article>
            <article className="ui-card p-5" id="portfolio-by-counterparty">
              <p className="ui-label-caps">Open exceptions by counterparty</p>
              <p className="mt-1 text-xs text-zinc-500">Contracts with exceptions, grouped by counterparty key.</p>
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
              >
                Open JSON API
              </Link>
            </article>
          </div>
          <details className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 text-xs text-zinc-600">
            <summary className="cursor-pointer font-medium text-zinc-800">Raw analytics payloads</summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-zinc-700">
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
      ) : null}

      <section id="capacity-forecasts" className="grid scroll-mt-8 gap-4 lg:grid-cols-3">
        <article className="ui-card p-5">
          <p className="ui-label-caps">Capacity forecasts</p>
          <p className="mt-2 text-sm text-zinc-600">
            Recent forecast runs. Latest snapshot includes open tasks, pending approvals, and open decisions.
          </p>
          {simOn ? (
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Redistribution planning: compare pending approvals and open tasks in{" "}
              <Link href="/reports#portfolio-signals" className="ui-link">
                portfolio signals
              </Link>{" "}
              with the breakdowns above, then adjust routing or ownership in programs and maintenance tools.
            </p>
          ) : null}
          {deltaTasks !== null ? (
            <p className="mt-2 text-xs text-zinc-600">
              Change in open tasks vs previous forecast run:{" "}
              <span className="font-semibold text-zinc-800">
                {deltaTasks > 0 ? `+${deltaTasks}` : String(deltaTasks)}
              </span>
            </p>
          ) : null}
          {deltaStalledDecisions !== null ? (
            <p className="mt-2 text-xs text-zinc-600">
              Change in stalled decision risk (daily snapshot vs prior day):{" "}
              <span className="font-semibold text-zinc-800">
                {deltaStalledDecisions > 0 ? `+${deltaStalledDecisions}` : String(deltaStalledDecisions)}
              </span>
            </p>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {(forecasts ?? []).map((f) => {
              const fj = f.forecast_json as Record<string, unknown> | null;
              return (
                <li key={f.id}>
                  Horizon {f.forecast_horizon_days}d · {new Date(f.generated_at).toLocaleString()}
                  {fj && typeof fj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] === "number" ? (
                    <span className="ml-1 text-xs text-zinc-500">
                      (tasks {String(fj[CAPACITY_FORECAST_JSON_KEYS.open_tasks])}, approvals{" "}
                      {String(fj[CAPACITY_FORECAST_JSON_KEYS.pending_approvals] ?? "—")}, decisions{" "}
                      {String(fj[CAPACITY_FORECAST_JSON_KEYS.open_decisions] ?? "—")}
                      {typeof fj[CAPACITY_FORECAST_JSON_KEYS.contracts_without_owner] === "number"
                        ? `, unassigned contracts ${String(fj[CAPACITY_FORECAST_JSON_KEYS.contracts_without_owner])}`
                        : ""}
                      )
                    </span>
                  ) : null}
                </li>
              );
            })}
            {(forecasts ?? []).length === 0 && <li className="text-zinc-500">No forecasts available.</li>}
          </ul>
          <Link href="/api/capacity/forecast" className="ui-link mt-3 inline-block text-xs" target="_blank">
            Open forecast API
          </Link>
        </article>

        <article className="ui-card p-5">
          <p className="ui-label-caps">Reassignment planner</p>
          <p className="mt-2 text-sm text-zinc-600">
            Model delegation quickly, then apply owner updates in campaign and decision workflows.
          </p>
          <form
            className="mt-4 grid gap-2"
            action="/api/capacity/reassignment-plan"
            method="post"
            target="_blank"
          >
            <label className="text-xs text-zinc-600">
              Team key
              <input
                name="teamKey"
                className="ui-input-compact mt-1 w-full"
                defaultValue="ops"
                required
              />
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

        <article className="ui-card p-5">
          <p className="ui-label-caps">Recommendation flow</p>
          <p className="mt-2 text-sm text-zinc-600">Accept or dismiss grounded recommendations.</p>
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
                      accepted={r.accepted}
                      dismissed={r.dismissed}
                    />
                  ) : null}
                </div>
              </li>
            ))}
            {(recommendations ?? []).length === 0 && <li className="py-2 text-zinc-500">No recommendations available.</li>}
          </ul>
          <Link href="/api/intelligence/recommendations" className="ui-link mt-3 inline-block text-xs" target="_blank">
            Open recommendations API
          </Link>
        </article>

        <article className="ui-card p-5" id="campaign-drift">
          <p className="ui-label-caps">Campaign drift</p>
          <p className="mt-2 text-sm text-zinc-600">Monitor active campaign spread and control posture.</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {(activeCampaigns ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/campaigns/${c.id}`} className="ui-link">
                  {c.name}
                </Link>{" "}
                · {c.status}
              </li>
            ))}
            {(activeCampaigns ?? []).length === 0 && <li className="text-zinc-500">No active campaigns.</li>}
          </ul>
          <Link href="/campaigns" className="ui-link mt-3 inline-block text-xs">
            Open campaign center
          </Link>
        </article>
      </section>

      {canViewV5Telemetry && simOn && signalQualityDebug ? (
        <section className="ui-card scroll-mt-8 p-5" id="v5-success-metrics">
          <p className="ui-label-caps">V5 success metrics</p>
          <p className="mt-1 text-xs text-zinc-500">
            Counters merged from decisions, campaigns, recommendations, and V5 crons into{" "}
            <code className="rounded bg-zinc-100 px-1">org_behavior_metrics.v5_signal_quality_json</code>.
          </p>
          <p className="mt-2 text-xs text-zinc-600">As of {signalQualityDebug.metrics_date}.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {signalQualityRows.map((row) => (
              <article key={row.key} className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">{row.value}</p>
                <p className="mt-1 text-xs text-zinc-600">{row.label}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-400">{row.key}</p>
              </article>
            ))}
          </div>
          {signalQualityRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No numeric counters recorded yet for this org.</p>
          ) : null}
          <details className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 text-xs text-zinc-600">
            <summary className="cursor-pointer font-medium text-zinc-800">Raw JSON</summary>
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-zinc-700">
              {JSON.stringify(signalQualityDebug.v5_signal_quality_json ?? {}, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}
