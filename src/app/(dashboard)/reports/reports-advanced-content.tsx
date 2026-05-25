import Link from "next/link";
import { Activity, FileBarChart2 } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  isAdvancedModuleHidden,
  isAssuranceModuleHidden,
} from "@/lib/product-surface/context";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import type { AdminClient } from "@/lib/assurance/service";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/decision-intelligence/capacity-forecast-keys";
import {
  getPortfolioByCounterpartyRows,
  getPortfolioByProgramRows,
} from "@/lib/decision-intelligence/portfolio-analytics";
import { buildPortfolioSignalSummary } from "@/lib/decision-intelligence/portfolio-signal-summary";
import { parseSignalQualityForDisplay } from "@/lib/decision-intelligence/signal-quality-labels";
import { buildAssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";
import { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/assurance/outcomes";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { operationalToneFromSignalSeverity } from "@/lib/ui/operational-surface";
import { ReportsV6AssuranceAnalyticsSection } from "@/components/reports/reports-assurance-section";
import {
  ReportsCapacityCampaignsSection,
  ReportsOutcomeIntelligenceSection,
  ReportsPortfolioAnalyticsSection,
  ReportsV5SignalQualitySection,
} from "@/components/reports/reports-control-room-more";

export async function ReportsAdvancedContent(props: {
  admin: AdminClient;
  orgId: string;
  role: WorkspaceRole;
  productSurface: ProductSurfaceContext;
}) {
  const { admin, orgId, role, productSurface } = props;
  const simOn = isFeatureEnabled("v5SimulationAndIntelligence");
  const outcomeIntelOn = isFeatureEnabled("v6OutcomeIntelligence");
  const v6AssuranceOn = isFeatureEnabled("v6AssuranceCore");
  const campaignsVisible = !isAdvancedModuleHidden(productSurface, "campaigns");
  const decisionsVisible = !isAdvancedModuleHidden(productSurface, "decisions");
  const relationshipsVisible = !isAdvancedModuleHidden(productSurface, "relationships");
  const analyticsVisible = !isAdvancedModuleHidden(productSurface, "analytics");
  const playbooksVisible = !isAssuranceModuleHidden(productSurface, "playbooks");
  const controlPoliciesVisible = !isAssuranceModuleHidden(productSurface, "control_policies");
  const outcomeIntelligenceVisible = !isAssuranceModuleHidden(productSurface, "outcome_intelligence");
  const canViewV5Telemetry = role === "admin" || role === "manager" || role === "ops_manager";
  const canViewAssuranceOps = role === "admin" || role === "manager" || role === "ops_manager";
  const showAnalyticsSurfaces = simOn && analyticsVisible;

  const outcomeIntelP =
    outcomeIntelOn && productSurface.mode === "assurance" && outcomeIntelligenceVisible
      ? computeOutcomeViews(admin, orgId)
      : Promise.resolve(null);
  const v6AssuranceAnalyticsP =
    v6AssuranceOn &&
    productSurface.mode === "assurance" &&
    (playbooksVisible || controlPoliciesVisible)
      ? buildAssuranceAnalyticsSummary(admin, orgId)
      : Promise.resolve(null);
  const quadP = Promise.all([
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

  const [outcomeIntel, v6AssuranceAnalytics, quadResult, portfolioByProgram, portfolioByCounterparty, signalQualityDebug, signalSummary] =
    await Promise.all([
      outcomeIntelP,
      v6AssuranceAnalyticsP,
      quadP,
      showAnalyticsSurfaces
        ? getPortfolioByProgramRows(admin, orgId)
        : Promise.resolve({ programs: [], error: null as string | null }),
      showAnalyticsSurfaces
        ? getPortfolioByCounterpartyRows(admin, orgId)
        : Promise.resolve({ counterparties: [], error: null as string | null }),
      simOn && canViewV5Telemetry
        ? admin
            .from("org_behavior_metrics")
            .select("metrics_date, v5_signal_quality_json")
            .eq("organization_id", orgId)
            .order("metrics_date", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then((r) => r.data ?? null)
        : Promise.resolve(null),
      showAnalyticsSurfaces
        ? buildPortfolioSignalSummary(admin, orgId).then((r) => r.signalSummary)
        : Promise.resolve([]),
    ]);

  const [{ data: forecasts }, { data: capacitySnapshots }, { data: recommendations }, { data: activeCampaigns }] =
    quadResult;

  const outcomeDrilldown =
    outcomeIntelOn &&
    productSurface.mode === "assurance" &&
    outcomeIntelligenceVisible &&
    !outcomeIntel?.error
      ? await listOutcomeInterventionsPaginated(admin, orgId, { limit: 20, offset: 0 })
      : null;

  const signalQualityRows = signalQualityDebug
    ? parseSignalQualityForDisplay(signalQualityDebug.v5_signal_quality_json)
    : [];

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
      <DashboardPageHeader
        icon={<FileBarChart2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Control-room reports"
        title="Operations reports"
        lead="Risk, capacity, and intervention effectiveness."
        actions={
          <Link
            href="/contracts/reports"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            View report packs
          </Link>
        }
      />

      {showAnalyticsSurfaces ? (
        <section id="portfolio-signals" className="scroll-mt-8 space-y-3">
          <div>
            <p className="ui-eyebrow">Portfolio</p>
            <h2 className="ui-page-title mt-2 text-[1.8rem]">Execution signals</h2>
            <p className="ui-section-lead mt-2">Grounded counts from live execution data.</p>
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
                action={{ href: "/reports#portfolio-signals", label: "Review portfolio signals" }}
                variant="compact"
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-[var(--text-tertiary)]">
          Portfolio analytics are hidden for this workspace configuration.
        </p>
      )}

      {v6AssuranceAnalytics ? (
        <ReportsV6AssuranceAnalyticsSection
          analytics={v6AssuranceAnalytics}
          canViewAssuranceOps={canViewAssuranceOps}
          showAssuranceMode={productSurface.mode === "assurance"}
        />
      ) : null}

      {showAnalyticsSurfaces ? (
        <ReportsPortfolioAnalyticsSection
          portfolioByProgram={portfolioByProgram}
          portfolioByCounterparty={portfolioByCounterparty}
          relationshipsVisible={relationshipsVisible}
        />
      ) : null}

      {showAnalyticsSurfaces ? (
        <ReportsCapacityCampaignsSection
          simOn={simOn}
          forecasts={forecasts ?? []}
          recommendations={recommendations ?? []}
          activeCampaigns={campaignsVisible ? activeCampaigns ?? [] : []}
          deltaTasks={deltaTasks}
          deltaStalledDecisions={decisionsVisible ? deltaStalledDecisions : null}
          latestOpenTasks={latestOpenTasks}
          latestPendingApprovals={latestPendingApprovals}
          showCampaignSurfaces={campaignsVisible}
          showDecisionSignals={decisionsVisible}
          showAnalyticsLinks={analyticsVisible}
        />
      ) : null}

      {canViewV5Telemetry && simOn && signalQualityDebug ? (
        <ReportsV5SignalQualitySection
          metricsDate={signalQualityDebug.metrics_date}
          rows={signalQualityRows}
        />
      ) : null}

      {outcomeIntelOn && outcomeIntelligenceVisible ? (
        <ReportsOutcomeIntelligenceSection
          outcomeIntel={outcomeIntel}
          outcomeDrilldown={outcomeDrilldown}
          canViewAssuranceOps={canViewAssuranceOps}
          visibility={{
            campaigns: campaignsVisible,
            playbooks: playbooksVisible,
            controlPolicies: controlPoliciesVisible,
          }}
        />
      ) : null}
    </div>
  );
}
