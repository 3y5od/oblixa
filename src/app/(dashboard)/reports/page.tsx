import Link from "next/link";
import { Activity } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { assertAnyV5PageFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/v5/capacity-forecast-keys";
import {
  getPortfolioByCounterpartyRows,
  getPortfolioByProgramRows,
} from "@/lib/v5/portfolio-analytics";
import { buildPortfolioSignalSummary } from "@/lib/v5/portfolio-signal-summary";
import { parseV5SignalQualityForDisplay } from "@/lib/v5/v5-signal-quality-labels";
import { buildAssuranceAnalyticsSummary } from "@/lib/v6/assurance-analytics";
import { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/v6/outcomes";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { operationalToneFromSignalSeverity } from "@/lib/ui/operational-surface";
import { ReportsV6AssuranceAnalyticsSection } from "@/components/reports/reports-v6-assurance-section";
import {
  ReportsCapacityCampaignsSection,
  ReportsOutcomeIntelligenceSection,
  ReportsPortfolioAnalyticsSection,
  ReportsV5SignalQualitySection,
} from "@/components/reports/reports-control-room-more";

export default async function ReportsControlRoomPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertAnyV5PageFeature(["v5ControlRoomUx", "v5SimulationAndIntelligence"]);
  const { admin, orgId, role } = ctx;
  const simOn = isFeatureEnabled("v5SimulationAndIntelligence");
  const outcomeIntelOn = isFeatureEnabled("v6OutcomeIntelligence");
  const v6AssuranceOn = isFeatureEnabled("v6AssuranceCore");
  const canViewV5Telemetry = role === "admin" || role === "manager" || role === "ops_manager";
  const canViewAssuranceOps = role === "admin" || role === "manager" || role === "ops_manager";

  const outcomeIntel = outcomeIntelOn ? await computeOutcomeViews(admin, orgId) : null;
  const outcomeDrilldown =
    outcomeIntelOn && !outcomeIntel?.error
      ? await listOutcomeInterventionsPaginated(admin, orgId, { limit: 20, offset: 0 })
      : null;
  const v6AssuranceAnalytics = v6AssuranceOn ? await buildAssuranceAnalyticsSummary(admin, orgId) : null;

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
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Control-room reports</p>
          <h1 className="ui-display-title mt-2">Operations reports</h1>
          <p className="ui-muted-tight mt-2 max-w-2xl">Risk, capacity, and intervention effectiveness.</p>
        </div>
        <Link href="/contracts/reports" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          View report packs
        </Link>
      </header>

      {simOn ? (
        <section id="portfolio-signals" className="scroll-mt-8 space-y-3">
          <div>
            <p className="ui-eyebrow">Portfolio</p>
            <h2 className="ui-section-title mt-2 text-xl">Execution signals</h2>
            <p className="ui-muted-tight mt-1 text-[13px]">Grounded counts from live execution data.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {signalSummary.map((s) => (
              <OperationalSummaryCard
                key={s.key}
                eyebrow="Signal"
                headline={s.label}
                tone={operationalToneFromSignalSeverity(s.severity, s.value)}
                icon={Activity}
                primaryValue={s.value}
                primaryUnit="current count"
                breakdown={[{ label: "Severity", value: s.severity }]}
                action={{ href: "/reports#portfolio-signals", label: "View on this page" }}
                variant="compact"
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">
          Turn on <code className="rounded bg-zinc-100 px-1">ENABLE_V5_SIMULATION_AND_INTELLIGENCE</code> to load
          portfolio signal cards.
        </p>
      )}

      {v6AssuranceAnalytics ? (
        <ReportsV6AssuranceAnalyticsSection
          analytics={v6AssuranceAnalytics}
          canViewAssuranceOps={canViewAssuranceOps}
        />
      ) : null}

      {simOn ? (
        <ReportsPortfolioAnalyticsSection
          portfolioByProgram={portfolioByProgram}
          portfolioByCounterparty={portfolioByCounterparty}
        />
      ) : null}

      <ReportsCapacityCampaignsSection
        simOn={simOn}
        forecasts={forecasts ?? []}
        recommendations={recommendations ?? []}
        activeCampaigns={activeCampaigns ?? []}
        deltaTasks={deltaTasks}
        deltaStalledDecisions={deltaStalledDecisions}
        latestOpenTasks={latestOpenTasks}
        latestPendingApprovals={latestPendingApprovals}
      />

      {canViewV5Telemetry && simOn && signalQualityDebug ? (
        <ReportsV5SignalQualitySection
          metricsDate={signalQualityDebug.metrics_date}
          rows={signalQualityRows}
          rawJson={signalQualityDebug.v5_signal_quality_json}
        />
      ) : null}

      {outcomeIntelOn ? (
        <ReportsOutcomeIntelligenceSection
          outcomeIntel={outcomeIntel}
          outcomeDrilldown={outcomeDrilldown}
          canViewAssuranceOps={canViewAssuranceOps}
        />
      ) : null}
    </div>
  );
}
