import { Suspense } from "react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardUpper } from "@/components/dashboard/dashboard-upper";
import { DashboardLower } from "@/components/dashboard/dashboard-lower";
import { V5ControlRoomStrip } from "@/components/dashboard/v5-control-room-strip";
import type { WorkspaceRole } from "@/lib/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
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
  const showControlRoomStrip = isFeatureEnabled("v5ControlRoomUx");
  const v6AssuranceOn = isFeatureEnabled("v6AssuranceCore");
  const v6OutcomeOn = isFeatureEnabled("v6OutcomeIntelligence");
  const intelligenceOn = isFeatureEnabled("v5SimulationAndIntelligence");
  const liveControlRoom = showControlRoomStrip
    ? await fetchControlRoomDashboardData(admin, orgId)
    : null;

  const canViewV5Telemetry =
    workspaceRole === "admin" ||
    workspaceRole === "manager" ||
    workspaceRole === "ops_manager";
  const canViewAssuranceOps =
    workspaceRole === "admin" ||
    workspaceRole === "manager" ||
    workspaceRole === "ops_manager";
  let telemetryCompact: { metricsDate: string; rows: ReturnType<typeof parseV5SignalQualityForDisplay> } | null =
    null;
  if ((intelligenceOn || showControlRoomStrip) && canViewV5Telemetry) {
    const { data } = await admin
      .from("org_behavior_metrics")
      .select("metrics_date, v5_signal_quality_json")
      .eq("organization_id", orgId)
      .order("metrics_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.metrics_date) {
      telemetryCompact = {
        metricsDate: data.metrics_date,
        rows: parseV5SignalQualityForDisplay(data.v5_signal_quality_json),
      };
    }
  }

  let v6Snapshot: {
    openFindings: number;
    highSeverity: number;
    avgScore: number | null;
    playbooksRunning: number;
    playbooksAwaitingApproval: number;
    graphEdges: number;
    publishedPolicies: number;
  } | null = null;
  if (v6AssuranceOn) {
    const [
      { count: openFindings },
      { count: highSeverity },
      { data: scorecards },
      { count: playbooksRunning },
      { count: playbooksAwaitingApproval },
      { count: graphEdges },
      { count: publishedPolicies },
    ] = await Promise.all([
      admin
        .from("assurance_findings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "open"),
      admin
        .from("assurance_findings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"])
        .in("severity", ["high", "critical"]),
      admin
        .from("assurance_scorecards")
        .select("overall_score")
        .eq("organization_id", orgId)
        .limit(25),
      admin
        .from("adaptive_playbook_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "running"),
      admin
        .from("adaptive_playbook_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "awaiting_approval"),
      admin
        .from("portfolio_health_graph_edges")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      admin
        .from("control_policies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "published"),
    ]);
    const scoreValues = (scorecards ?? [])
      .map((row) => Number(row.overall_score))
      .filter((value) => Number.isFinite(value));
    v6Snapshot = {
      openFindings: openFindings ?? 0,
      highSeverity: highSeverity ?? 0,
      avgScore:
        scoreValues.length > 0
          ? Number(
              (scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(2)
            )
          : null,
      playbooksRunning: playbooksRunning ?? 0,
      playbooksAwaitingApproval: playbooksAwaitingApproval ?? 0,
      graphEdges: graphEdges ?? 0,
      publishedPolicies: publishedPolicies ?? 0,
    };
  }

  const v6Analytics = v6AssuranceOn ? await buildAssuranceAnalyticsSummary(admin, orgId) : null;
  const v6AssuranceRuns = v6AssuranceOn
    ? (
        await admin
          .from("assurance_check_runs")
          .select("watch_signals_json, recommended_interventions_json, risk_delta_json, summary_json, created_at")
          .eq("organization_id", orgId)
          .eq("check_type", "portfolio_assurance")
          .order("created_at", { ascending: false })
          .limit(2)
      ).data
    : null;
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
  if (v6OutcomeOn) {
    const [views, page] = await Promise.all([
      computeOutcomeViews(admin, orgId),
      listOutcomeInterventionsPaginated(admin, orgId, { limit: 5, offset: 0 }),
    ]);
    outcomeViews = views;
    if (!page.error) outcomeRecentRows = page.rows;
  }

  return (
    <div className="ui-page-stack">
      {showControlRoomStrip ? <V5ControlRoomStrip liveCards={liveControlRoom?.cards} /> : null}
      {telemetryCompact ? (
        <V5TelemetryCompact metricsDate={telemetryCompact.metricsDate} rows={telemetryCompact.rows} />
      ) : null}

      {v6Snapshot ? (
        <div className="ui-card p-5">
          <DashboardV6AssuranceSnapshotSection
            v6Snapshot={v6Snapshot}
            v6Analytics={v6Analytics}
            watchSignalsPreview={watchSignalsPreview}
            recommendedPreview={recommendedPreview}
            v6PriorAssuranceRun={v6PriorAssuranceRun}
            v6LastAssuranceRun={v6LastAssuranceRun}
            canViewAssuranceOps={canViewAssuranceOps}
          />
        </div>
      ) : null}

      {outcomeViews?.summary ? (
        <div className="ui-card p-5">
          <DashboardOutcomeIntelligenceSection
            summary={outcomeViews.summary}
            recentRows={outcomeRecentRows}
          />
        </div>
      ) : null}

      {v6Analytics && canViewAssuranceOps ? (
        <div className="ui-card p-5">
          <DashboardAssuranceSignalsSection analytics={v6Analytics} />
        </div>
      ) : null}

      <Suspense fallback={<DashboardUpperFallback />}>
        <DashboardUpper
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
        />
      </Suspense>
      <Suspense fallback={<DashboardLowerFallback />}>
        <DashboardLower
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
        />
      </Suspense>
    </div>
  );
}
