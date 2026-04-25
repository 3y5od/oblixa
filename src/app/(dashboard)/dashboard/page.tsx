/**
 * product-surface policy §8 — Home layout intent (viewport order is a best-effort match to DOM):
 * §8.1 six questions: (1) action now → stats + command shortcuts (DashboardUpper); (2) due soon → upcoming dates;
 * (3) blocked → tasks/obligations with blockers; (4) missing → missing fields; (5) changed recently → recent contracts;
 * (6) owned work → My tasks/obligations. Portfolio/Advanced strips above Suspense are mode-gated (§8.3).
 * §8.2 eight bullets map to DashboardUpper (metrics, deadlines, shortcuts), DashboardLower (tasks, obligations,
 * approvals context, renewals horizon via dates, exceptions via queues, evidence via missing/usage, review backlog,
 * recent contracts).
 */
import { Suspense } from "react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardUpper } from "@/components/dashboard/dashboard-upper";
import { DashboardLower } from "@/components/dashboard/dashboard-lower";
import { V5ControlRoomStrip } from "@/components/dashboard/v5-control-room-strip";
import type { WorkspaceRole } from "@/lib/navigation";
import { fetchControlRoomDashboardData } from "@/lib/v5/control-room-dashboard";
import { V5TelemetryCompact } from "@/components/dashboard/v5-telemetry-compact";
import { parseV5SignalQualityForDisplay } from "@/lib/v5/v5-signal-quality-labels";
import { buildAssuranceAnalyticsSummary } from "@/lib/v6/assurance-analytics";
import { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/v6/outcomes";
import {
  DashboardAssuranceSignalsSection,
  DashboardOutcomeIntelligenceSection,
  DashboardV6AssuranceSnapshotSection,
} from "@/components/dashboard/dashboard-v6-operational-blocks";
import {
  isAssuranceAutomationModuleHidden,
  loadProductSurfaceContext,
} from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import type { FeatureFamilyKey } from "@/lib/product-surface/feature-registry";
import { isHomeBlockAllowed } from "@/lib/product-surface/resolver";

export const metadata = { title: "Dashboard" };

function DashboardUpperFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="ui-skeleton h-40 rounded-2xl" />
      <div className="ui-skeleton h-24 rounded-2xl" />
      <div className="ui-skeleton h-32 rounded-2xl" />
    </div>
  );
}

function DashboardLowerFallback() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="ui-skeleton h-64 rounded-2xl" />
        <div className="ui-skeleton h-64 rounded-2xl" />
        <div className="ui-skeleton h-64 rounded-2xl" />
      </div>
      <div className="ui-skeleton h-48 rounded-2xl" />
    </div>
  );
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ view?: string; qf?: string }>;
}) {
  const { view: rawView, qf: rawQuickFilter } = await props.searchParams;
  const view =
    rawView === "team" || rawView === "portfolio" || rawView === "personal"
      ? rawView
      : "personal";
  const quickFilter =
    rawQuickFilter === "approvals" ||
    rawQuickFilter === "deadlines" ||
    rawQuickFilter === "data_gaps"
      ? rawQuickFilter
      : "all";
  const ctx = await getAuthContext();
  if (!ctx) {
    return <WorkspaceRequiredState />;
  }

  const { orgId, user, role, admin } = ctx;
  const workspaceRole = role as WorkspaceRole;
  const productSurface = await loadProductSurfaceContext(admin, orgId, workspaceRole);
  const isCoreHome = productSurface.mode === "core";
  const featureAllowed = (featureFamily: FeatureFamilyKey) =>
    evaluateFeatureEligibility(productSurface, featureFamily, {
      surfaceType: "page",
      surfaceIdentifier: featureFamily,
    }).allowed;
  const findingsVisible = featureAllowed("findings");
  const controlPoliciesVisible = featureAllowed("control_policies");
  const scorecardsVisible = featureAllowed("scorecards");
  const playbooksVisible = featureAllowed("playbooks");
  const automationOpsVisible =
    featureAllowed("autopilot") && !isAssuranceAutomationModuleHidden(productSurface);
  const reviewBoardsVisible = featureAllowed("review_boards");
  const programEvolutionVisible = featureAllowed("program_evolution");
  const healthGraphVisible = featureAllowed("health_graph");
  const outcomeIntelligenceVisible = featureAllowed("outcome_intelligence");
  const v6 = productSurface.v6;
  const showPortfolioIntel =
    !isCoreHome && (productSurface.mode === "advanced" || productSurface.mode === "assurance");

  const showControlRoomStrip = showPortfolioIntel && productSurface.featureFlags.v5ControlRoomUx;
  const v6AssuranceOn = productSurface.featureFlags.v6AssuranceCore;
  const v6OutcomeOn = productSurface.featureFlags.v6OutcomeIntelligence;
  const intelligenceOn = productSurface.featureFlags.v5SimulationAndIntelligence;

  const canViewV5Telemetry =
    workspaceRole === "admin" ||
    workspaceRole === "manager" ||
    workspaceRole === "ops_manager";
  const canViewAssuranceOps =
    workspaceRole === "admin" ||
    workspaceRole === "manager" ||
    workspaceRole === "ops_manager";
  const hasVisibleAssuranceSnapshotCards =
    findingsVisible ||
    controlPoliciesVisible ||
    scorecardsVisible ||
    playbooksVisible ||
    reviewBoardsVisible ||
    healthGraphVisible;

  type V6Snapshot = {
    openFindings: number;
    highSeverity: number;
    avgScore: number | null;
    playbooksRunning: number;
    playbooksAwaitingApproval: number;
    graphEdges: number;
    publishedPolicies: number;
  };

  const v6SnapshotP: Promise<V6Snapshot | null> =
    productSurface.mode === "assurance" && v6AssuranceOn && hasVisibleAssuranceSnapshotCards
      ? (async () => {
          const [
            { count: openFindings },
            { count: highSeverity },
            { data: scorecards },
            { count: playbooksRunning },
            { count: playbooksAwaitingApproval },
            { count: graphEdges },
            { count: publishedPolicies },
          ] = await Promise.all([
            findingsVisible
              ? admin
                  .from("assurance_findings")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
                  .eq("status", "open")
              : Promise.resolve({ count: 0, error: null }),
            findingsVisible
              ? admin
                  .from("assurance_findings")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
                  .in("status", ["open", "in_review"])
                  .in("severity", ["high", "critical"])
              : Promise.resolve({ count: 0, error: null }),
            scorecardsVisible
              ? admin
                  .from("assurance_scorecards")
                  .select("overall_score")
                  .eq("organization_id", orgId)
                  .limit(25)
              : Promise.resolve({ data: [], error: null }),
            playbooksVisible
              ? admin
                  .from("adaptive_playbook_runs")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
                  .eq("status", "running")
              : Promise.resolve({ count: 0, error: null }),
            playbooksVisible
              ? admin
                  .from("adaptive_playbook_runs")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
                  .eq("status", "awaiting_approval")
              : Promise.resolve({ count: 0, error: null }),
            healthGraphVisible
              ? admin
                  .from("portfolio_health_graph_edges")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
              : Promise.resolve({ count: 0, error: null }),
            controlPoliciesVisible
              ? admin
                  .from("control_policies")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
                  .eq("status", "published")
              : Promise.resolve({ count: 0, error: null }),
          ]);
          const scoreValues = (scorecards ?? [])
            .map((row) => Number(row.overall_score))
            .filter((value) => Number.isFinite(value));
          return {
            openFindings: openFindings ?? 0,
            highSeverity: highSeverity ?? 0,
            avgScore:
              scoreValues.length > 0
                ? Number(
                    (scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(
                      2
                    )
                  )
                : null,
            playbooksRunning: playbooksRunning ?? 0,
            playbooksAwaitingApproval: playbooksAwaitingApproval ?? 0,
            graphEdges: graphEdges ?? 0,
            publishedPolicies: publishedPolicies ?? 0,
          };
        })()
      : Promise.resolve(null);

  const telemetryP =
    showPortfolioIntel && (intelligenceOn || showControlRoomStrip) && canViewV5Telemetry
      ? admin
          .from("org_behavior_metrics")
          .select("metrics_date, v5_signal_quality_json")
          .eq("organization_id", orgId)
          .order("metrics_date", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null);

  const v6AnalyticsP =
    productSurface.mode === "assurance" &&
    v6AssuranceOn &&
    (controlPoliciesVisible || playbooksVisible || automationOpsVisible || canViewAssuranceOps)
      ? buildAssuranceAnalyticsSummary(admin, orgId)
      : Promise.resolve(null);

  const v6AssuranceRunsP =
    productSurface.mode === "assurance" && v6AssuranceOn && (reviewBoardsVisible || scorecardsVisible)
      ? admin
          .from("assurance_check_runs")
          .select(
            "watch_signals_json, recommended_interventions_json, risk_delta_json, summary_json, created_at"
          )
          .eq("organization_id", orgId)
          .eq("check_type", "portfolio_assurance")
          .order("created_at", { ascending: false })
          .limit(2)
          .then(({ data }) => data ?? null)
      : Promise.resolve(null);

  const outcomeP =
    productSurface.mode === "assurance" && v6OutcomeOn && outcomeIntelligenceVisible
      ? Promise.all([
          computeOutcomeViews(admin, orgId),
          listOutcomeInterventionsPaginated(admin, orgId, { limit: 5, offset: 0 }),
        ]).then(([views, page]) => ({ views, page }))
      : Promise.resolve(null);

  const [
    liveControlRoom,
    telemetryData,
    v6Snapshot,
    v6Analytics,
    v6AssuranceRuns,
    outcomeBundle,
  ] = await Promise.all([
    showControlRoomStrip ? fetchControlRoomDashboardData(admin, orgId) : Promise.resolve(null),
    telemetryP,
    v6SnapshotP,
    v6AnalyticsP,
    v6AssuranceRunsP,
    outcomeP,
  ]);

  let telemetryCompact: {
    metricsDate: string;
    rows: ReturnType<typeof parseV5SignalQualityForDisplay>;
  } | null = null;
  if (telemetryData?.metrics_date) {
    telemetryCompact = {
      metricsDate: telemetryData.metrics_date,
      rows: parseV5SignalQualityForDisplay(telemetryData.v5_signal_quality_json),
    };
  }

  const v6LastAssuranceRun = v6AssuranceRuns?.[0] ?? null;
  const v6PriorAssuranceRun = v6AssuranceRuns?.[1] ?? null;
  const watchSignalsPreview =
    v6LastAssuranceRun && Array.isArray(v6LastAssuranceRun.watch_signals_json)
      ? (v6LastAssuranceRun.watch_signals_json as string[]).slice(0, 3)
      : [];
  const recommendedPreview =
    v6LastAssuranceRun && Array.isArray(v6LastAssuranceRun.recommended_interventions_json)
      ? (v6LastAssuranceRun.recommended_interventions_json as string[]).slice(0, 3)
      : [];

  let outcomeViews: Awaited<ReturnType<typeof computeOutcomeViews>> | null = null;
  let outcomeRecentRows: Awaited<ReturnType<typeof listOutcomeInterventionsPaginated>>["rows"] = [];
  if (outcomeBundle) {
    outcomeViews = outcomeBundle.views;
    if (!outcomeBundle.page.error) outcomeRecentRows = outcomeBundle.page.rows;
  }

  return (
    <div className="ui-page-stack">
      {showControlRoomStrip && isHomeBlockAllowed("control_room_strip", v6) ? (
        <V5ControlRoomStrip liveCards={liveControlRoom?.cards} />
      ) : null}
      {telemetryCompact && isHomeBlockAllowed("telemetry_compact", v6) ? (
        <V5TelemetryCompact metricsDate={telemetryCompact.metricsDate} rows={telemetryCompact.rows} />
      ) : null}

      {v6Snapshot && isHomeBlockAllowed("v6_assurance_snapshot", v6) ? (
        <div className="ui-card p-5">
          <DashboardV6AssuranceSnapshotSection
            v6Snapshot={v6Snapshot}
            v6Analytics={v6Analytics}
            watchSignalsPreview={watchSignalsPreview}
            recommendedPreview={recommendedPreview}
            v6PriorAssuranceRun={v6PriorAssuranceRun}
            v6LastAssuranceRun={v6LastAssuranceRun}
            canViewAssuranceOps={canViewAssuranceOps}
            showAssuranceMode={productSurface.mode === "assurance"}
            visibility={{
              findings: findingsVisible,
              controlPolicies: controlPoliciesVisible,
              healthGraph: healthGraphVisible,
              playbooks: playbooksVisible,
              reviewBoards: reviewBoardsVisible,
              scorecards: scorecardsVisible,
              programEvolution: programEvolutionVisible,
              automationOps: automationOpsVisible,
            }}
          />
        </div>
      ) : null}

      {outcomeViews?.summary && isHomeBlockAllowed("outcome_intelligence", v6) ? (
        <div className="ui-card p-5">
          <DashboardOutcomeIntelligenceSection
            summary={outcomeViews.summary}
            recentRows={outcomeRecentRows}
          />
        </div>
      ) : null}

      {productSurface.mode === "assurance" &&
      v6Analytics &&
      canViewAssuranceOps &&
      (controlPoliciesVisible || playbooksVisible || automationOpsVisible) &&
      isHomeBlockAllowed("assurance_signals", v6) ? (
        <div className="ui-card p-5">
          <DashboardAssuranceSignalsSection
            analytics={v6Analytics}
            showAssuranceMode={productSurface.mode === "assurance"}
            visibility={{
              controlPolicies: controlPoliciesVisible,
              playbooks: playbooksVisible,
              automationOps: automationOpsVisible,
            }}
          />
        </div>
      ) : null}

      <Suspense fallback={<DashboardUpperFallback />}>
        <DashboardUpper
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
          workspaceProductMode={productSurface.mode}
          productSurfaceContext={productSurface}
        />
      </Suspense>
      <Suspense fallback={<DashboardLowerFallback />}>
        <DashboardLower
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
          productSurfaceContext={productSurface}
        />
      </Suspense>
    </div>
  );
}
