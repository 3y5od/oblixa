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
import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { OperationalTriagePanel } from "@/components/ui/operational-summary-card";
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
import { SCHEDULED_AUTOMATION_RUNNER_FEATURE_FAMILY } from "@/lib/product-surface/scheduled-automation-feature-family";
import { isHomeBlockAllowed } from "@/lib/product-surface/resolver";
import { compareV10WorkReadModelRows } from "@/lib/v10-work-semantics";
import { getV10ReadableRoleMinimums, getV10ReadableWorkspaceModes } from "@/lib/v10-visibility";
import { operationalActionLabel } from "@/lib/ui/operational-copy";
import { sortOperationalPriority } from "@/lib/ui/operational-priority";

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
  const v10ReadableRoleMinimums = getV10ReadableRoleMinimums(role);
  const v10ReadableWorkspaceModes = getV10ReadableWorkspaceModes(productSurface.mode);
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
    featureAllowed(SCHEDULED_AUTOMATION_RUNNER_FEATURE_FAMILY) &&
    !isAssuranceAutomationModuleHidden(productSurface);
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
    v10OpenWork,
    v10DueTodayWork,
    v10OverdueWork,
    v10BlockedWork,
    v10UnassignedWork,
    v10FailedJobs,
    v10FailedReports,
    v10EvidenceAccountability,
    v10UnhealthyContracts,
    v10RenewalAttention,
    v10RecentActivity,
    v10TopWork,
    v10DueTodayRows,
    v10OverdueRows,
    v10BlockedRows,
    v10RecentActivityRows,
    v10FailedJobRows,
    v10FailedReportRows,
    v10RenewalRows,
    v10HealthRows,
  ] = await Promise.all([
    showControlRoomStrip ? fetchControlRoomDashboardData(admin, orgId) : Promise.resolve(null),
    telemetryP,
    v6SnapshotP,
    v6AnalyticsP,
    v6AssuranceRunsP,
    outcomeP,
    admin
      .from("v10_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .neq("status", "done"),
    admin
      .from("v10_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .eq("due_state", "due_today")
      .neq("status", "done"),
    admin
      .from("v10_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .eq("due_state", "overdue"),
    admin
      .from("v10_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .eq("status", "blocked"),
    admin
      .from("v10_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .eq("owner_state", "unassigned")
      .neq("status", "done"),
    admin
      .from("v10_work_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .in("type", ["report_failure", "export_failure", "import_failure", "extraction_failure"])
      .neq("status", "done"),
    admin
      .from("v10_report_run_visibility")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .in("status", ["partial", "failed_retryable", "failed_terminal"]),
    admin
      .from("v10_evidence_request_statuses")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .in("status", ["overdue", "rejected"]),
    admin
      .from("v10_contract_health_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .lt("score", 85),
    admin
      .from("v10_renewal_posture_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .in("posture", ["plan", "negotiate", "notice_deadline_approaching", "notice_overdue", "renewal_overdue", "blocked_missing_approved_dates"]),
    admin
      .from("v10_contract_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes),
    admin
      .from("v10_work_items")
      .select("source_id, source_table, type, title, status, due_state, due_at, contract_id, primary_action, blocked_reason, severity, priority, last_state_change_at, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(6),
    admin
      .from("v10_work_items")
      .select("source_id, source_table, type, title, status, due_state, due_at, contract_id, primary_action, blocked_reason, severity, priority, last_state_change_at, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .eq("due_state", "due_today")
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("v10_work_items")
      .select("source_id, source_table, type, title, status, due_state, due_at, contract_id, primary_action, blocked_reason, severity, priority, last_state_change_at, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .eq("due_state", "overdue")
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("v10_work_items")
      .select("source_id, source_table, type, title, status, due_state, due_at, contract_id, primary_action, blocked_reason, severity, priority, last_state_change_at, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .eq("status", "blocked")
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("v10_contract_activity_events")
      .select("contract_id, action, safe_summary, outcome, occurred_at, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .order("occurred_at", { ascending: false })
      .limit(4),
    admin
      .from("v10_job_run_visibility")
      .select("job_id, job_class, status, retry_action, user_visible_detail, diagnostic_id, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .in("status", ["partial", "failed_retryable", "failed_terminal"])
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("v10_report_run_visibility")
      .select("report_run_id, report_family, status, failure_category, diagnostic_id, retry_action, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .in("status", ["partial", "failed_retryable", "failed_terminal"])
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("v10_renewal_posture_snapshots")
      .select("contract_id, posture, horizon, blocked_reason, approved_notice_deadline, next_checkpoint_work_item_id, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .in("posture", ["plan", "negotiate", "notice_deadline_approaching", "notice_overdue", "renewal_overdue", "blocked_missing_approved_dates"])
      .order("updated_at", { ascending: false })
      .limit(4),
    admin
      .from("v10_contract_health_snapshots")
      .select("contract_id, score, band, next_action, updated_at")
      .eq("organization_id", orgId)
      .eq("visibility_state", "visible")
      .in("required_role_minimum", v10ReadableRoleMinimums)
      .in("workspace_mode", v10ReadableWorkspaceModes)
      .lt("score", 85)
      .order("score", { ascending: true })
      .limit(4),
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

  type V10DashboardWorkRow = {
    source_id: string | null;
    source_table: string | null;
    type: string;
    title: string | null;
    status: string;
    due_state: string | null;
    due_at: string | null;
    contract_id: string | null;
    primary_action: string | null;
    blocked_reason: string | null;
    severity: string | null;
    priority: string | null;
    last_state_change_at: string | null;
    updated_at: string | null;
  };
  const v10WorkHref = (item: Pick<V10DashboardWorkRow, "contract_id" | "type">) =>
    item.contract_id
      ? `/contracts/${item.contract_id}`
      : item.type === "report_failure"
        ? "/reports"
        : item.type === "export_failure"
          ? "/settings/health#exports"
          : "/work";
  const v10Label = (value: string | null | undefined, fallback: string) =>
    String(value ?? fallback).replace(/_/g, " ");
  const sortV10WorkRows = (rows: V10DashboardWorkRow[]) => [...rows].sort(compareV10WorkReadModelRows);
  const v10TopWorkRows = sortV10WorkRows((v10TopWork.data ?? []) as V10DashboardWorkRow[]);
  const v10PrimaryAction = v10TopWorkRows[0] ?? null;
  const v10DashboardReadModelErrorCount = [
    v10OpenWork.error,
    v10DueTodayWork.error,
    v10OverdueWork.error,
    v10BlockedWork.error,
    v10UnassignedWork.error,
    v10FailedJobs.error,
    v10FailedReports.error,
    v10EvidenceAccountability.error,
    v10UnhealthyContracts.error,
    v10RenewalAttention.error,
    v10RecentActivity.error,
    v10TopWork.error,
    v10DueTodayRows.error,
    v10OverdueRows.error,
    v10BlockedRows.error,
    v10RecentActivityRows.error,
    v10FailedJobRows.error,
    v10FailedReportRows.error,
    v10RenewalRows.error,
    v10HealthRows.error,
  ].filter(Boolean).length;
  const v10PrimaryActionDescription = v10PrimaryAction
    ? [
        v10Label(v10PrimaryAction.type, "work item"),
        v10Label(v10PrimaryAction.status, "open"),
        v10PrimaryAction.due_state && v10PrimaryAction.due_state !== "none"
          ? v10Label(v10PrimaryAction.due_state, "due state")
          : null,
        v10PrimaryAction.blocked_reason,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const v10TriageCategories = [
    {
      id: "failed_reports",
      kind: "failed_report" as const,
      title: "Reports affected",
      description: "Partial or failed report runs need review before stakeholders rely on them.",
      count: v10FailedReports.count ?? 0,
      failed: (v10FailedReports.count ?? 0) > 0,
      href: "/reports",
      actionLabel: "Review reports",
    },
    {
      id: "failed_jobs",
      kind: "failed_job" as const,
      title: "Jobs needing retry",
      description: "Import, export, extraction, or report recovery work is waiting.",
      count: v10FailedJobs.count ?? 0,
      failed: (v10FailedJobs.count ?? 0) > 0,
      href: "/work?lens=failed_jobs",
      actionLabel: "Review recovery",
    },
    {
      id: "overdue",
      kind: "work" as const,
      title: "Overdue work",
      description: "Work has passed its target date and should be cleared before routine items.",
      count: v10OverdueWork.count ?? 0,
      dueState: "overdue",
      href: "/work?lens=overdue",
      actionLabel: "Clear overdue work",
    },
    {
      id: "blocked",
      kind: "blocked" as const,
      title: "Blocked work",
      description: "Items have a blocker or dependency that needs an owner or decision.",
      count: v10BlockedWork.count ?? 0,
      blocked: (v10BlockedWork.count ?? 0) > 0,
      href: "/work?lens=blocked",
      actionLabel: "Resolve blockers",
    },
    {
      id: "evidence",
      kind: "evidence" as const,
      title: "Evidence needs attention",
      description: "Overdue or rejected evidence is blocking contract workflow.",
      count: v10EvidenceAccountability.count ?? 0,
      href: "/contracts?evidence=attention",
      actionLabel: "Review evidence",
    },
    {
      id: "renewals",
      kind: "renewal" as const,
      title: "Renewal risk",
      description: "Renewals have approaching deadlines, overdue dates, or missing approved date context.",
      count: v10RenewalAttention.count ?? 0,
      href: "/contracts/renewals",
      actionLabel: "Review renewals",
    },
    {
      id: "health",
      kind: "contract_health" as const,
      title: "Contract health",
      description: "Contracts have health scores below the watch threshold.",
      count: v10UnhealthyContracts.count ?? 0,
      href: "/contracts?health=watch",
      actionLabel: "Review contract health",
    },
    {
      id: "unassigned",
      kind: "ownership" as const,
      title: "Unassigned work",
      description: "Work is waiting for an owner before it can move.",
      count: v10UnassignedWork.count ?? 0,
      ownerMissing: (v10UnassignedWork.count ?? 0) > 0,
      href: "/work?lens=unassigned",
      actionLabel: "Assign owners",
    },
    {
      id: "due_today",
      kind: "work" as const,
      title: "Due today",
      description: "Work due today after higher-risk exceptions are handled.",
      count: v10DueTodayWork.count ?? 0,
      dueState: "due_today",
      href: "/work?lens=due_today",
      actionLabel: "Review today's work",
    },
    {
      id: "recent",
      kind: "recent_activity" as const,
      title: "Recent changes",
      description: "Recent contract activity for context after exceptions are clear.",
      count: v10RecentActivity.count ?? 0,
      href: "/contracts?sort=updated",
      actionLabel: "Review activity",
    },
  ];
  const v10TriageItems = [
    ...(v10PrimaryAction
      ? [
          {
            id: "primary-action",
            title: v10PrimaryAction.title ?? "Review next action",
            description: v10PrimaryActionDescription ?? undefined,
            tone:
              v10PrimaryAction.status === "blocked" ||
              v10PrimaryAction.due_state === "overdue" ||
              v10PrimaryAction.severity === "critical" ||
              v10PrimaryAction.severity === "high"
                ? ("risk" as const)
                : ("attention" as const),
            href: v10WorkHref(v10PrimaryAction),
            actionLabel: operationalActionLabel(v10PrimaryAction.primary_action, "open_contract"),
          },
        ]
      : []),
    ...sortOperationalPriority(v10TriageCategories).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      count: item.count ?? 0,
      tone: item.tone,
      href: item.href,
      actionLabel: item.actionLabel,
    })),
  ];

  return (
    <div className="ui-page-stack">
      {v10DashboardReadModelErrorCount > 0 ? (
        <V10RecoverableState
          state="partial"
          title="Dashboard data is partially unavailable"
          reason={`${v10DashboardReadModelErrorCount} dashboard query${
            v10DashboardReadModelErrorCount === 1 ? "" : "ies"
          } returned partial data. Live navigation remains available while data freshness is restored.`}
          accessibleName="Dashboard partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link href="/settings/health" className="ui-link">
              Review workspace health
            </Link>
          }
        />
      ) : null}
      <OperationalTriagePanel
        eyebrow="Operations"
        title="Exceptions and decisions requiring attention"
        description="Active risk, recovery work, ownership gaps, and deadlines are shown first. Normal categories stay compressed."
        items={v10TriageItems}
        allClear={{
          title: "No exceptions requiring action",
          description: "No overdue, blocked, failed, or ownership-blocked work is visible for this workspace.",
          action: { href: "/work", label: "Review work queue" },
        }}
        diagnostics={
          <>
            Data freshness checks are available in workspace health. This view uses visible work, report, evidence,
            renewal, health, and activity signals scoped to your role and workspace mode.
          </>
        }
      />
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
