import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  FileText,
  HeartPulse,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { OperationalQueueRow } from "@/components/ui/operational-summary-card";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { getOrgMemberRole } from "@/lib/permissions";
import { hasRoleCapability } from "@/lib/access-control";
import {
  getImportJobDetail,
  getImportJobHeadline,
  importJobCanRetry,
} from "@/lib/import-job-visibility";
import { getExportJobDetail, getExportJobHeadline } from "@/lib/export-job-visibility";
import { isExtractionProcessingStale } from "@/lib/extraction/constants";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import { ImportJobRetryButton, V10JobRetryButton } from "@/components/contracts/import-job-retry-button";
import {
  buildWorkspaceHealthItem,
  filterWorkspaceHealthItems,
  formatIsoMinute,
  formatPercentOrNoSample,
  formatSampleDetail,
  getAffectedWorkspaceHealthCount,
  getOverallWorkspaceHealthStatus,
  parseWorkspaceHealthMode,
  statusLabel,
  statusTone,
  type WorkspaceHealthItem,
} from "@/lib/workspace-health-model";
import { SettingsHealthDiagnosticsSections } from "./settings-health-diagnostics-sections";

export const metadata = { title: "System health" };

type HealthTone = "neutral" | "attention" | "risk" | "healthy";

type FailedDeliveryRow = {
  notification_type: string | null;
  last_error: string | null;
  created_at: string;
  metadata: unknown;
};

type StatusRow = { status?: string | null; intake_status?: string | null; due_at?: string | null };

function humanize(value: unknown): string {
  return String(value ?? "").replace(/_/g, " ");
}

function healthItemTone(item: WorkspaceHealthItem): HealthTone {
  const tone = statusTone(item.status);
  return tone === "healthy" ? "healthy" : tone;
}

function countRows(rows: unknown[] | null | undefined, predicate?: (row: StatusRow) => boolean): number {
  const list = (rows ?? []) as StatusRow[];
  return predicate ? list.filter(predicate).length : list.length;
}

function workspaceStatusHeadline(item: WorkspaceHealthItem | null): string {
  if (!item) return "Workspace systems are clear";
  if (item.id === "automated-recovery" && item.status === "not_configured") {
    return "Recovery setup needed";
  }
  if (item.status === "blocked") return `${item.label} is blocked`;
  if (item.status === "delayed") return `${item.label} is delayed`;
  return `${item.label} needs attention`;
}

function visibleStatusLabel(status: WorkspaceHealthItem["status"]): string {
  if (status === "not_configured") return "Setup needed";
  return statusLabel(status);
}

function heroNarrativeText(
  item: WorkspaceHealthItem | null,
  allClearSentence: string,
): string {
  if (!item) return allClearSentence;
  if (item.id === "automated-recovery" && item.status === "not_configured") {
    return "Recovery worker is not configured. Reminder and notification retries cannot be trusted.";
  }
  return item.userImpact ?? item.detail ?? `${item.label} needs attention.`;
}

function workspaceSemanticStatus(status: WorkspaceHealthItem["status"]): SemanticStatus {
  if (status === "healthy") return "healthy";
  if (status === "blocked" || status === "needs_attention") return "critical";
  if (status === "delayed" || status === "not_configured") return "warning";
  return "info";
}

function heroMedallionClass(status: WorkspaceHealthItem["status"]): string {
  const base =
    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[var(--shadow-1)]";
  if (status === "healthy") {
    return `${base} border-[color:color-mix(in_oklab,var(--success-soft)_42%,var(--border-subtle))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--success-soft)_88%,white)_0%,color-mix(in_oklab,var(--success-soft)_62%,white)_100%)] text-[var(--success-ink)]`;
  }
  if (status === "blocked" || status === "needs_attention") {
    return `${base} border-[color:color-mix(in_oklab,var(--danger-soft)_42%,var(--border-subtle))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--danger-soft)_88%,white)_0%,color-mix(in_oklab,var(--danger-soft)_62%,white)_100%)] text-[var(--danger-ink)]`;
  }
  if (status === "delayed" || status === "not_configured") {
    return `${base} border-[color:color-mix(in_oklab,var(--warning-soft)_42%,var(--border-subtle))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--warning-soft)_88%,white)_0%,color-mix(in_oklab,var(--warning-soft)_62%,white)_100%)] text-[var(--warning-ink)]`;
  }
  return `${base} border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)]`;
}

function HeroStatusIcon({ status }: { status: WorkspaceHealthItem["status"] }) {
  const cls = "h-7 w-7";
  if (status === "healthy") return <ShieldCheck className={cls} strokeWidth={1.65} aria-hidden />;
  if (status === "blocked" || status === "needs_attention") {
    return <ShieldAlert className={cls} strokeWidth={1.65} aria-hidden />;
  }
  if (status === "delayed" || status === "not_configured") {
    return <Wrench className={cls} strokeWidth={1.65} aria-hidden />;
  }
  return <RefreshCw className={cls} strokeWidth={1.65} aria-hidden />;
}

function usefulHealthChips(item: WorkspaceHealthItem) {
  return (item.chips ?? []).filter((chip) => chip.value !== "0");
}

function hasUsefulHealthyDetail(item: WorkspaceHealthItem): boolean {
  return usefulHealthChips(item).length > 0 || /\d{4}-\d{2}-\d{2}/.test(item.detail ?? "");
}

function healthyDetailText(item: WorkspaceHealthItem): string {
  const chips = usefulHealthChips(item);
  if (chips.length > 0) {
    return chips.map((chip) => `${chip.label}: ${chip.value}`).join(" · ");
  }
  return item.detail ?? "Clear";
}

function HealthCheckRow({ item }: { item: WorkspaceHealthItem }) {
  const detail = healthyDetailText(item);
  return (
    <li className="group/row flex items-center gap-3 py-2 text-sm">
      <span
        className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--success-ink)] ring-2 ring-[color:color-mix(in_oklab,var(--success-soft)_42%,transparent)]"
        aria-hidden
      />
      <span className="shrink-0 text-[14px] font-medium tracking-tight text-[var(--text-primary)]">
        {item.label}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-right font-mono text-[11px] text-[var(--text-tertiary)]"
        title={detail}
      >
        {detail}
      </span>
    </li>
  );
}

export default async function SettingsHealthPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, user } = ctx;

  const [role, workflowSettingsRes, orgSettings] = await Promise.all([
    getOrgMemberRole(admin, user.id, orgId),
    admin
      .from("organization_workflow_settings")
      .select("role_policy_json")
      .eq("organization_id", orgId)
      .maybeSingle(),
    getOrgSettingsJson(admin, orgId),
  ]);
  const canOpenHealth = hasRoleCapability({
    role,
    capability: "settings_manage",
    rolePolicyJson: (workflowSettingsRes.data?.role_policy_json as Record<string, unknown> | null) ?? null,
  });
  if (!canOpenHealth) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Workspace</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">System health</h1>
        <div className="mt-6 max-w-xl rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">System health is restricted</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            You do not have permission to view operational health details for this workspace.
          </p>
          <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
            Ask a workspace admin to grant settings access or open a support-safe diagnostic from another authorized
            account.
          </p>
        </div>
      </div>
    );
  }

  const mode = parseWorkspaceHealthMode(orgSettings.workspace_mode);
  const hiddenFeatures = new Set<string>([
    ...((orgSettings.advanced_modules_hidden ?? []) as string[]).map((key) => `advanced:${key}`),
    ...((orgSettings.assurance_modules_hidden ?? []) as string[]).map((key) => `assurance:${key}`),
    ...((orgSettings.utility_modules_hidden ?? []) as string[]).map((key) => `utility:${key}`),
  ]);
  const nowIso = new Date().toISOString();
  const [
    webhookRes,
    reportRunsRes,
    operationalEventsRes,
    pendingRes,
    retryingRes,
    failedRes,
    suppressedRes,
    importJobsRes,
    exportJobsRes,
    extractionJobsRes,
    remindersRes,
    contractsRes,
    tasksRes,
    obligationsRes,
    approvalsRes,
    exceptionsRes,
    evidenceReqsRes,
    maintenanceCampaignsRes,
    reportPacksRes,
    watchlistsRes,
    fieldCommentsRes,
    programsRes,
    findingsRes,
    controlPoliciesRes,
    scorecardsRes,
    playbooksRes,
    playbookRunsRes,
    reviewBoardsRes,
    reviewBoardRunsRes,
    segmentsRes,
    autopilotRulesRes,
    autopilotRunsRes,
    programEvolutionRes,
    healthGraphNodesRes,
  ] = await Promise.all([
    admin
      .from("outbound_event_deliveries")
      .select("delivered, attempt_count, next_attempt_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("report_runs")
      .select("id, status, started_at")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(100),
    admin
      .from("audit_events")
      .select("action, created_at")
      .eq("organization_id", orgId)
      .in("action", [
        "integration.calendar_sync_run",
        "maintenance.correction_campaign",
        "maintenance.change_events_processed",
        "notifications.retry_deliveries_run",
      ])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "retrying"),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "failed"),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "suppressed"),
    admin
      .from("contract_import_jobs")
      .select(
        "id, status, total_rows, inserted_rows, error_rows, failure_reason, updated_at, completed_at, retry_of_job_id, superseded_by_job_id, created_at"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("contract_export_jobs")
      .select("status, selected_contract_count, exported_rows, truncated, error_message, created_at, completed_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("contract_extraction_jobs")
      .select("status, attempt_count, last_error, started_at, completed_at")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(50),
    admin
      .from("reminders")
      .select("id, reminder_type, reminder_date, sent_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("contracts")
      .select("id, intake_status, status, required_next_step")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(200),
    admin
      .from("contract_tasks")
      .select("id, status, due_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("contract_obligations")
      .select("id, status, due_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("contract_approvals")
      .select("id, status, due_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("exceptions")
      .select("id, status, due_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("evidence_requirements")
      .select("id, status, due_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("maintenance_campaigns")
      .select("id, status")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("report_packs")
      .select("id, status")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("contract_watchlists")
      .select("id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("contract_field_comments")
      .select("id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("contract_programs")
      .select("id, state")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("assurance_findings")
      .select("id, status, severity")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("control_policies")
      .select("id, status")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("scorecard_snapshots")
      .select("id, snapshot_at")
      .eq("organization_id", orgId)
      .order("snapshot_at", { ascending: false })
      .limit(50),
    admin
      .from("adaptive_playbooks")
      .select("id, active")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("adaptive_playbook_runs")
      .select("id, status")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("review_boards")
      .select("id, active")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("review_board_runs")
      .select("id, status")
      .eq("organization_id", orgId)
      .order("generated_at", { ascending: false })
      .limit(100),
    admin
      .from("segment_definitions")
      .select("id, active")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("autopilot_rules")
      .select("id, enabled")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("autopilot_run_logs")
      .select("id, status")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("program_evolution_experiments")
      .select("id, status")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("portfolio_health_graph_nodes")
      .select("id, updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  const [failedTypesRes, deliveredRecentRes, failedRecentRes] = await Promise.all([
    admin
      .from("notification_deliveries")
      .select("notification_type, last_error, created_at, metadata")
      .eq("organization_id", orgId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("notification_deliveries")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("notification_deliveries")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const pendingDeliveries = pendingRes.count ?? 0;
  const retryingDeliveries = retryingRes.count ?? 0;
  const failedDeliveries = failedRes.count ?? 0;
  const suppressedDeliveries = suppressedRes.count ?? 0;
  const retryQueueDepth = pendingDeliveries + retryingDeliveries;
  const deliveredRecent = deliveredRecentRes.data?.length ?? 0;
  const failedRecent = failedRecentRes.data?.length ?? 0;
  const hasDeliverySample = deliveredRecent + failedRecent > 0;
  const deliverySuccessRateRecent = hasDeliverySample
    ? (deliveredRecent / (deliveredRecent + failedRecent)) * 100
    : null;

  const reportRuns = reportRunsRes.data ?? [];
  const reportRunsFailed = reportRuns.filter((run) => run.status === "failed");
  const reportRunsSucceeded = reportRuns.filter((run) => run.status === "succeeded");
  const reportRunsRunning = reportRuns.filter((run) => run.status === "running");
  const failedReportRuns = reportRunsFailed.length;
  const hasReportRunSample = reportRunsSucceeded.length + reportRunsFailed.length > 0;
  const reportSuccessRateRecent = hasReportRunSample
    ? (reportRunsSucceeded.length / (reportRunsSucceeded.length + reportRunsFailed.length)) * 100
    : null;
  const latestFailedReportAt = reportRunsFailed[0]?.started_at ?? null;
  const latestFailedReportId = (reportRunsFailed[0] as { id?: string } | undefined)?.id ?? null;
  const latestSucceededReportAt = reportRunsSucceeded[0]?.started_at ?? null;

  const webhookPending = (webhookRes.data ?? []).filter((d) => !d.delivered).length;
  const webhookHighAttempts = (webhookRes.data ?? []).filter((d) => Number(d.attempt_count ?? 0) >= 3).length;
  const importJobs = importJobsRes.data ?? [];
  const exportJobs = exportJobsRes.data ?? [];
  const extractionJobs = extractionJobsRes.data ?? [];
  const reminderRuns = remindersRes.data ?? [];
  const todayIso = nowIso.slice(0, 10);

  const latestImportJob = importJobs[0] ?? null;
  const retryableImportJob = importJobs.find((job) => importJobCanRetry(job)) ?? null;
  const latestExportJob = exportJobs[0] ?? null;
  const latestExtractionJob = extractionJobs[0] ?? null;
  const latestReminderRun = reminderRuns[0] ?? null;
  const failedImportJobs = importJobs.filter((job) => job.status === "failed").length;
  const partialImportJobs = importJobs.filter(
    (job) => job.status !== "failed" && Number(job.error_rows ?? 0) > 0
  ).length;
  const processingImportJobs = importJobs.filter((job) => job.status === "processing").length;
  const failedExportJobs = exportJobs.filter((job) => job.status === "failed").length;
  const limitedExportJobs = exportJobs.filter((job) => job.status === "partial" || Boolean(job.truncated)).length;
  const activeExportJobs = exportJobs.filter((job) => job.status === "queued" || job.status === "processing").length;
  const failedExtractionJobs = extractionJobs.filter((job) => job.status === "failed").length;
  const staleExtractionJobs = extractionJobs.filter(
    (job) => job.status === "processing" && isExtractionProcessingStale(job.started_at)
  ).length;
  const activeExtractionJobs = extractionJobs.filter(
    (job) => job.status === "pending" || job.status === "processing"
  ).length;
  const dueReminderRuns = reminderRuns.filter(
    (row) => !row.sent_at && String(row.reminder_date ?? "") <= todayIso
  ).length;
  const scheduledReminderRuns = reminderRuns.filter(
    (row) => !row.sent_at && String(row.reminder_date ?? "") > todayIso
  ).length;
  const sentReminderRuns = reminderRuns.filter((row) => Boolean(row.sent_at)).length;
  const contractRows = (contractsRes.data ?? []) as StatusRow[];
  const intakeWaitingCount = countRows(contractRows, (row) =>
    ["awaiting_review", "in_clarification"].includes(String(row.intake_status ?? ""))
  );
  const reviewReadyCount = countRows(contractRows, (row) => Boolean((row as { required_next_step?: string | null }).required_next_step));
  const taskRows = (tasksRes.data ?? []) as StatusRow[];
  const blockedTaskCount = countRows(taskRows, (row) => row.status === "blocked");
  const openTaskCount = countRows(taskRows, (row) => ["open", "in_progress"].includes(String(row.status ?? "")));
  const obligationRows = (obligationsRes.data ?? []) as StatusRow[];
  const openObligationCount = countRows(obligationRows, (row) => ["open", "in_progress"].includes(String(row.status ?? "")));
  const approvalRows = (approvalsRes.data ?? []) as StatusRow[];
  const pendingApprovalCount = countRows(approvalRows, (row) => ["pending", "escalated"].includes(String(row.status ?? "")));
  const exceptionRows = (exceptionsRes.data ?? []) as StatusRow[];
  const openExceptionCount = countRows(exceptionRows, (row) => ["open", "in_progress"].includes(String(row.status ?? "")));
  const evidenceRows = (evidenceReqsRes.data ?? []) as StatusRow[];
  const rejectedEvidenceCount = countRows(evidenceRows, (row) => row.status === "rejected");
  const requiredEvidenceCount = countRows(evidenceRows, (row) => row.status === "required");
  const maintenanceRows = (maintenanceCampaignsRes.data ?? []) as StatusRow[];
  const failedMaintenanceCount = countRows(maintenanceRows, (row) => row.status === "failed");
  const activeMaintenanceCount = countRows(maintenanceRows, (row) => ["running", "paused"].includes(String(row.status ?? "")));
  const reportPackRows = (reportPacksRes.data ?? []) as StatusRow[];
  const failedReportPackCount = countRows(reportPackRows, (row) => row.status === "failed");
  const runningReportPackCount = countRows(reportPackRows, (row) => ["queued", "running"].includes(String(row.status ?? "")));
  const watchlistCount = watchlistsRes.data?.length ?? 0;
  const fieldCommentCount = fieldCommentsRes.data?.length ?? 0;
  const programRows = (programsRes.data ?? []) as Array<{ state?: string | null }>;
  const programCount = programRows.length;
  const activeProgramCount = programRows.filter((row) => ["active", "published"].includes(String(row.state ?? ""))).length;
  const findingRows = (findingsRes.data ?? []) as Array<StatusRow & { severity?: string | null }>;
  const openFindingCount = countRows(findingRows, (row) => ["open", "in_review"].includes(String(row.status ?? "")));
  const criticalFindingCount = findingRows.filter((row) => ["high", "critical"].includes(String(row.severity ?? ""))).length;
  const controlPolicyRows = (controlPoliciesRes.data ?? []) as StatusRow[];
  const publishedControlPolicyCount = countRows(controlPolicyRows, (row) => row.status === "published");
  const draftControlPolicyCount = countRows(controlPolicyRows, (row) => row.status === "draft");
  const scorecardSnapshotCount = scorecardsRes.data?.length ?? 0;
  const playbookRows = (playbooksRes.data ?? []) as Array<{ active?: boolean | null }>;
  const activePlaybookCount = playbookRows.filter((row) => row.active).length;
  const playbookRunRows = (playbookRunsRes.data ?? []) as StatusRow[];
  const failedPlaybookRunCount = countRows(playbookRunRows, (row) => row.status === "failed");
  const runningPlaybookRunCount = countRows(playbookRunRows, (row) =>
    ["queued", "previewed", "awaiting_approval", "running"].includes(String(row.status ?? ""))
  );
  const reviewBoardRows = (reviewBoardsRes.data ?? []) as Array<{ active?: boolean | null }>;
  const activeReviewBoardCount = reviewBoardRows.filter((row) => row.active).length;
  const reviewBoardRunRows = (reviewBoardRunsRes.data ?? []) as StatusRow[];
  const generatedReviewBoardRunCount = countRows(reviewBoardRunRows, (row) => row.status === "generated");
  const segmentRows = (segmentsRes.data ?? []) as Array<{ active?: boolean | null }>;
  const activeSegmentCount = segmentRows.filter((row) => row.active).length;
  const autopilotRuleRows = (autopilotRulesRes.data ?? []) as Array<{ enabled?: boolean | null }>;
  const enabledAutopilotCount = autopilotRuleRows.filter((row) => row.enabled).length;
  const autopilotRunRows = (autopilotRunsRes.data ?? []) as StatusRow[];
  const failedAutopilotRunCount = countRows(autopilotRunRows, (row) => row.status === "failed");
  const blockedAutopilotRunCount = countRows(autopilotRunRows, (row) => row.status === "blocked");
  const programEvolutionRows = (programEvolutionRes.data ?? []) as StatusRow[];
  const runningProgramEvolutionCount = countRows(programEvolutionRows, (row) => row.status === "running");
  const healthGraphNodeCount = healthGraphNodesRes.data?.length ?? 0;

  const latestImportHeadline = latestImportJob ? getImportJobHeadline(latestImportJob) : "No recent imports";
  const latestImportDetail = latestImportJob
    ? getImportJobDetail(latestImportJob)
    : "No recent import jobs are recorded yet.";
  const latestExportHeadline = latestExportJob ? getExportJobHeadline(latestExportJob) : "No recent exports";
  const latestExportDetail = latestExportJob
    ? getExportJobDetail(latestExportJob)
    : "No recent export jobs are recorded yet.";
  const latestExtractionHeadline =
    !latestExtractionJob
      ? "No recent extraction jobs"
      : latestExtractionJob.status === "failed"
        ? "Extraction failed"
        : latestExtractionJob.status === "pending"
          ? "Extraction queued"
          : latestExtractionJob.status === "processing"
            ? isExtractionProcessingStale(latestExtractionJob.started_at)
              ? "Extraction may be stuck"
              : "Extraction in progress"
            : "Extraction completed";
  const latestExtractionDetail =
    !latestExtractionJob
      ? "No recent extraction jobs are recorded yet."
      : latestExtractionJob.status === "failed"
        ? latestExtractionJob.last_error || "The latest extraction attempt failed."
        : latestExtractionJob.status === "pending"
          ? "A queued extraction is waiting for worker pickup."
          : latestExtractionJob.status === "processing"
            ? isExtractionProcessingStale(latestExtractionJob.started_at)
              ? "The latest extraction has been processing long enough that it may need a retry."
              : "The latest extraction run is still processing."
            : latestExtractionJob.completed_at
              ? `Latest extraction completed ${new Date(latestExtractionJob.completed_at).toISOString()}.`
              : "The latest extraction completed successfully.";
  const latestReminderHeadline =
    !latestReminderRun
      ? "No recent reminders"
      : latestReminderRun.sent_at
        ? "Reminder sent"
        : String(latestReminderRun.reminder_date ?? "") < todayIso
          ? "Reminder delivery is overdue"
          : String(latestReminderRun.reminder_date ?? "") === todayIso
            ? "Reminder due today"
            : "Reminder scheduled";
  const latestReminderDetail =
    !latestReminderRun
      ? "No recent reminder runs are recorded yet."
      : latestReminderRun.sent_at
        ? `Latest ${humanize(latestReminderRun.reminder_type || "reminder")} reminder sent ${new Date(latestReminderRun.sent_at).toISOString()}.`
        : String(latestReminderRun.reminder_date ?? "") < todayIso
          ? `Latest ${humanize(latestReminderRun.reminder_type || "reminder")} reminder has been due since ${String(latestReminderRun.reminder_date)}.`
          : `Latest ${humanize(latestReminderRun.reminder_type || "reminder")} reminder is scheduled for ${String(latestReminderRun.reminder_date ?? "the configured date")}.`;
  const lastRetryRunAt =
    (operationalEventsRes.data ?? []).find((evt) => evt.action === "notifications.retry_deliveries_run")
      ?.created_at ?? null;
  const referenceTimestamps = [
    (webhookRes.data ?? [])[0]?.created_at,
    (operationalEventsRes.data ?? [])[0]?.created_at,
    reportRuns[0]?.started_at,
  ].filter((v): v is string => Boolean(v));
  const referenceMs =
    referenceTimestamps.length > 0
      ? Math.max(...referenceTimestamps.map((v) => new Date(v).getTime()).filter((ms) => Number.isFinite(ms)))
      : null;
  const retryRunAgeMinutes =
    lastRetryRunAt && referenceMs != null
      ? Math.max(0, Math.round((referenceMs - new Date(lastRetryRunAt).getTime()) / 60_000))
      : null;
  const hasRecoveryHeartbeat = lastRetryRunAt != null;
  const hasRecoveryLag = retryRunAgeMinutes != null && retryRunAgeMinutes > 30;
  const hasActiveDeliveryIssue = retryQueueDepth > 0 || failedDeliveries > 0;
  const hasActiveReportIssue = failedReportRuns > 0 || reportRunsRunning.length > 0;
  const recoveryLastRunAt = formatIsoMinute(lastRetryRunAt);
  const recoveryStateLabel = !hasRecoveryHeartbeat
    ? "No recovery heartbeat recorded"
    : hasRecoveryLag
      ? `${retryRunAgeMinutes}m behind latest activity`
      : "Recovery activity recorded";
  const reportReliabilityLabel = formatPercentOrNoSample(reportSuccessRateRecent, "No report runs sampled");
  const deliveryReliabilityLabel = formatPercentOrNoSample(deliverySuccessRateRecent, "No deliveries sampled");
  const reportSampleDetail = formatSampleDetail(reportRunsSucceeded.length, failedReportRuns, "report run");
  const deliverySampleDetail = formatSampleDetail(deliveredRecent, failedRecent, "delivery");

  const healthItems = [
    buildWorkspaceHealthItem({
      id: "automated-recovery",
      area: "notifications",
      label: "Automated recovery",
      status: !hasRecoveryHeartbeat ? "not_configured" : hasRecoveryLag ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact:
        !hasRecoveryHeartbeat || hasRecoveryLag
          ? "Automated recovery has not recorded a heartbeat. Configure recovery before relying on reminder and notification retries."
          : undefined,
      detail: recoveryLastRunAt
        ? `${recoveryStateLabel}. Last recorded run ${recoveryLastRunAt}.`
        : recoveryStateLabel,
      primaryAction: { href: "/settings/operations", label: "Inspect recovery settings" },
      chips: recoveryLastRunAt ? [{ label: "Last run", value: recoveryLastRunAt }] : [],
    }),
    buildWorkspaceHealthItem({
      id: "intake",
      area: "imports",
      label: "Contract intake",
      status: intakeWaitingCount > 25 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      requiredFeature: "utility:intake",
      userImpact: intakeWaitingCount > 25 ? `${intakeWaitingCount} intake record${intakeWaitingCount === 1 ? "" : "s"} still need review or clarification.` : undefined,
      detail: `${intakeWaitingCount} contract${intakeWaitingCount === 1 ? "" : "s"} awaiting review or clarification in recent activity.`,
      primaryAction: { href: "/contracts/intake", label: "Review intake" },
      chips: [{ label: "Waiting", value: String(intakeWaitingCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "imports",
      area: "imports",
      label: "Imports",
      status: failedImportJobs > 0 ? "needs_attention" : processingImportJobs > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact:
        failedImportJobs > 0 || partialImportJobs > 0 || processingImportJobs > 0 ? latestImportHeadline : undefined,
      detail: latestImportDetail,
      primaryAction: { href: "/contracts/bulk#recent-imports", label: "Review import history" },
      chips: [
        { label: "Processing", value: String(processingImportJobs) },
        { label: "Failed", value: String(failedImportJobs) },
        { label: "Partial", value: String(partialImportJobs) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "contract-review",
      area: "extraction",
      label: "Contract review",
      status: reviewReadyCount > 25 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact: reviewReadyCount > 25 ? `${reviewReadyCount} contract${reviewReadyCount === 1 ? "" : "s"} have a recorded next step.` : undefined,
      detail: `${reviewReadyCount} contract${reviewReadyCount === 1 ? "" : "s"} include a required next step in recent activity.`,
      primaryAction: { href: "/contracts/review", label: "Review contracts" },
      chips: [{ label: "Next steps", value: String(reviewReadyCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "tasks",
      area: "configuration",
      label: "Tasks",
      status: blockedTaskCount > 0 ? "blocked" : openTaskCount > 25 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact: blockedTaskCount > 0 ? `${blockedTaskCount} task${blockedTaskCount === 1 ? " is" : "s are"} blocked.` : undefined,
      detail: `${openTaskCount} open or in-progress task${openTaskCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/contracts/tasks", label: "Review tasks" },
      chips: [
        { label: "Open", value: String(openTaskCount) },
        { label: "Blocked", value: String(blockedTaskCount) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "obligations",
      area: "configuration",
      label: "Obligations",
      status: openObligationCount > 50 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact: openObligationCount > 50 ? `${openObligationCount} obligation${openObligationCount === 1 ? "" : "s"} are open or in progress.` : undefined,
      detail: `${openObligationCount} open or in-progress obligation${openObligationCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/contracts/obligations", label: "Review obligations" },
      chips: [{ label: "Open", value: String(openObligationCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "extraction",
      area: "extraction",
      label: "Extraction",
      status: failedExtractionJobs > 0 || staleExtractionJobs > 0 ? "needs_attention" : activeExtractionJobs > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact:
        failedExtractionJobs > 0 || staleExtractionJobs > 0 || activeExtractionJobs > 0
          ? latestExtractionHeadline
          : undefined,
      detail: latestExtractionDetail,
      primaryAction: { href: "/contracts/review", label: "Review extraction follow-up" },
      chips: [
        { label: "Active", value: String(activeExtractionJobs) },
        { label: "Failed", value: String(failedExtractionJobs) },
        { label: "Stale", value: String(staleExtractionJobs) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "exports",
      area: "reports",
      label: "Exports",
      status: failedExportJobs > 0 ? "needs_attention" : activeExportJobs > 0 || limitedExportJobs > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact: failedExportJobs > 0 || limitedExportJobs > 0 || activeExportJobs > 0 ? latestExportHeadline : undefined,
      detail: latestExportDetail,
      primaryAction: { href: "/contracts#exports", label: "Review contract exports" },
      chips: [
        { label: "Active", value: String(activeExportJobs) },
        { label: "Failed", value: String(failedExportJobs) },
        { label: "Limited", value: String(limitedExportJobs) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "reports",
      area: "reports",
      label: "Reports",
      status: failedReportRuns >= 3 ? "needs_attention" : failedReportRuns > 0 || reportRunsRunning.length > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact:
        failedReportRuns > 0
          ? latestFailedReportAt
            ? `Latest failed run started ${new Date(latestFailedReportAt).toISOString()}.`
            : `${failedReportRuns} recent report run${failedReportRuns === 1 ? " has" : "s have"} failed.`
          : undefined,
      detail: hasReportRunSample
        ? `${reportReliabilityLabel} successful runs in recent activity. ${reportSampleDetail}.`
        : `${reportReliabilityLabel}.`,
      primaryAction: { href: "/contracts/reports", label: "Review report history" },
      chips: [
        { label: "Succeeded", value: String(reportRunsSucceeded.length) },
        { label: "Running", value: String(reportRunsRunning.length) },
        { label: "Failed", value: String(failedReportRuns) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "reminders",
      area: "reminders",
      label: "Reminders",
      status: dueReminderRuns > 0 ? "needs_attention" : scheduledReminderRuns > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact: dueReminderRuns > 0 || scheduledReminderRuns > 0 ? latestReminderHeadline : undefined,
      detail: latestReminderDetail,
      primaryAction: { href: "/contracts/renewals", label: "Review renewals" },
      chips: [
        { label: "Due", value: String(dueReminderRuns) },
        { label: "Scheduled", value: String(scheduledReminderRuns) },
        { label: "Sent", value: String(sentReminderRuns) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "notifications",
      area: "notifications",
      label: "Notifications",
      status: failedDeliveries >= 10 ? "needs_attention" : retryQueueDepth > 0 || failedDeliveries > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact:
        retryQueueDepth > 0
          ? `Reminder and digest messages may arrive late while ${retryQueueDepth} delivery item${retryQueueDepth === 1 ? " is" : "s are"} pending or retrying.`
          : failedDeliveries > 0
            ? `${failedDeliveries} failed delivery item${failedDeliveries === 1 ? "" : "s"} in recent activity.`
            : undefined,
      detail: hasDeliverySample
        ? `${deliveryReliabilityLabel} delivered vs failed in recent activity. ${deliverySampleDetail}.`
        : `${deliveryReliabilityLabel}.`,
      primaryAction: { href: "/settings/operations", label: "Review notification settings" },
      chips: [
        { label: "Pending", value: String(pendingDeliveries) },
        { label: "Retrying", value: String(retryingDeliveries) },
        { label: "Failed", value: String(failedDeliveries) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "integrations",
      area: "integrations",
      label: "Integrations",
      status: webhookPending > 0 || webhookHighAttempts > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["core"],
      userImpact:
        webhookPending > 0 || webhookHighAttempts > 0
          ? "Connected systems may not have received the latest workspace events."
          : undefined,
      detail: `${webhookPending} undelivered outbound sample${webhookPending === 1 ? "" : "s"}; ${webhookHighAttempts} needed 3+ attempts.`,
      primaryAction: { href: "/settings/operations", label: "Check integrations" },
      chips: [
        { label: "Undelivered", value: String(webhookPending) },
        { label: "3+ attempts", value: String(webhookHighAttempts) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-approvals",
      area: "approvals",
      label: "Approvals",
      status: pendingApprovalCount > 25 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "utility:approval_workload",
      userImpact: pendingApprovalCount > 25 ? `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? "" : "s"} are pending or escalated.` : undefined,
      detail: `${pendingApprovalCount} pending or escalated approval${pendingApprovalCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/contracts/approvals", label: "Review approvals" },
      chips: [{ label: "Pending", value: String(pendingApprovalCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-exceptions",
      area: "exceptions",
      label: "Exceptions",
      status: openExceptionCount > 0 ? "needs_attention" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      userImpact: openExceptionCount > 0 ? `${openExceptionCount} exception${openExceptionCount === 1 ? "" : "s"} need review.` : undefined,
      detail: `${openExceptionCount} open or in-progress exception${openExceptionCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/contracts/exceptions", label: "Review exceptions" },
      chips: [{ label: "Open", value: String(openExceptionCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-evidence",
      area: "evidence",
      label: "Evidence and review cadence",
      status: rejectedEvidenceCount > 0 ? "needs_attention" : requiredEvidenceCount > 25 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "utility:review_cadence",
      userImpact: rejectedEvidenceCount > 0 ? `${rejectedEvidenceCount} evidence request${rejectedEvidenceCount === 1 ? "" : "s"} were rejected.` : undefined,
      detail: `${requiredEvidenceCount} required evidence item${requiredEvidenceCount === 1 ? "" : "s"} and ${rejectedEvidenceCount} rejected item${rejectedEvidenceCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/contracts/evidence-studio", label: "Review evidence" },
      chips: [
        { label: "Required", value: String(requiredEvidenceCount) },
        { label: "Rejected", value: String(rejectedEvidenceCount) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-analytics",
      area: "analytics",
      label: "Analytics and reports",
      status: failedReportPackCount > 0 ? "needs_attention" : runningReportPackCount > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "advanced:analytics",
      userImpact: failedReportPackCount > 0 ? `${failedReportPackCount} report pack${failedReportPackCount === 1 ? "" : "s"} failed.` : undefined,
      detail: `${runningReportPackCount} report pack${runningReportPackCount === 1 ? "" : "s"} queued or running; ${failedReportPackCount} failed.`,
      primaryAction: { href: "/reports", label: "Review reports" },
      chips: [
        { label: "Running", value: String(runningReportPackCount) },
        { label: "Failed", value: String(failedReportPackCount) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-watchlists",
      area: "analytics",
      label: "Watchlists",
      status: watchlistCount === 0 ? "not_configured" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "utility:watchlists",
      detail: `${watchlistCount} watchlist entr${watchlistCount === 1 ? "y" : "ies"} in recent activity.`,
      primaryAction: { href: "/contracts/watchlists", label: "Review watchlists" },
      chips: [{ label: "Entries", value: String(watchlistCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-bulk-maintenance",
      area: "configuration",
      label: "Bulk operations and maintenance",
      status: failedMaintenanceCount > 0 ? "needs_attention" : activeMaintenanceCount > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "advanced:maintenance",
      userImpact: failedMaintenanceCount > 0 ? `${failedMaintenanceCount} maintenance campaign${failedMaintenanceCount === 1 ? "" : "s"} failed.` : undefined,
      detail: `${activeMaintenanceCount} maintenance campaign${activeMaintenanceCount === 1 ? "" : "s"} running or paused; ${failedMaintenanceCount} failed.`,
      primaryAction: { href: "/contracts/maintenance", label: "Review maintenance" },
      chips: [
        { label: "Active", value: String(activeMaintenanceCount) },
        { label: "Failed", value: String(failedMaintenanceCount) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-collaboration",
      area: "configuration",
      label: "Collaboration",
      status: fieldCommentCount > 100 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "advanced:collaboration",
      detail: `${fieldCommentCount} recent field comment${fieldCommentCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/contracts/collaboration", label: "Review collaboration" },
      chips: [{ label: "Comments", value: String(fieldCommentCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "advanced-programs",
      area: "configuration",
      label: "Programs",
      status: programCount === 0 ? "not_configured" : "healthy",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "advanced:programs",
      detail: `${programCount} program${programCount === 1 ? "" : "s"} in recent activity; ${activeProgramCount} active or published.`,
      primaryAction: { href: "/contracts/programs", label: "Review programs" },
      chips: [
        { label: "Programs", value: String(programCount) },
        { label: "Active", value: String(activeProgramCount) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "assurance-findings",
      area: "assurance",
      label: "Findings",
      status: criticalFindingCount > 0 ? "needs_attention" : openFindingCount > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:findings",
      userImpact: criticalFindingCount > 0 ? `${criticalFindingCount} high or critical finding${criticalFindingCount === 1 ? "" : "s"} need review.` : undefined,
      detail: `${openFindingCount} open or in-review finding${openFindingCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/assurance/findings", label: "Review findings" },
      chips: [
        { label: "Open", value: String(openFindingCount) },
        { label: "High+", value: String(criticalFindingCount) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "assurance-controls",
      area: "assurance",
      label: "Control policies",
      status: publishedControlPolicyCount === 0 ? "not_configured" : draftControlPolicyCount > 10 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:control_policies",
      userImpact: publishedControlPolicyCount === 0 ? "No published control policies are available for assurance checks." : undefined,
      detail: `${publishedControlPolicyCount} published policy${publishedControlPolicyCount === 1 ? "" : "ies"} and ${draftControlPolicyCount} draft policy${draftControlPolicyCount === 1 ? "" : "ies"}.`,
      primaryAction: { href: "/assurance/control-policies", label: "Review policies" },
      chips: [
        { label: "Published", value: String(publishedControlPolicyCount) },
        { label: "Draft", value: String(draftControlPolicyCount) },
      ],
    }),
    buildWorkspaceHealthItem({
      id: "assurance-scorecards",
      area: "assurance",
      label: "Scorecards",
      status: scorecardSnapshotCount === 0 ? "not_configured" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:scorecards",
      detail: `${scorecardSnapshotCount} scorecard snapshot${scorecardSnapshotCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/assurance/scorecards", label: "Review scorecards" },
      chips: [{ label: "Snapshots", value: String(scorecardSnapshotCount) }],
    }),
    buildWorkspaceHealthItem({
      id: "assurance-playbooks",
      area: "assurance",
      label: "Playbooks",
      status: failedPlaybookRunCount > 0 ? "needs_attention" : runningPlaybookRunCount > 0 ? "delayed" : activePlaybookCount === 0 ? "not_configured" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:playbooks",
      userImpact: failedPlaybookRunCount > 0 ? `${failedPlaybookRunCount} playbook run${failedPlaybookRunCount === 1 ? "" : "s"} failed.` : undefined,
      detail: `${activePlaybookCount} active playbook${activePlaybookCount === 1 ? "" : "s"}; ${runningPlaybookRunCount} queued or running; ${failedPlaybookRunCount} failed.`,
      primaryAction: { href: "/assurance/playbooks", label: "Review playbooks" },
    }),
    buildWorkspaceHealthItem({
      id: "assurance-review-boards",
      area: "assurance",
      label: "Review boards",
      status: activeReviewBoardCount === 0 ? "not_configured" : generatedReviewBoardRunCount > 10 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:review_boards",
      detail: `${activeReviewBoardCount} active board${activeReviewBoardCount === 1 ? "" : "s"}; ${generatedReviewBoardRunCount} generated run${generatedReviewBoardRunCount === 1 ? "" : "s"} awaiting review or close.`,
      primaryAction: { href: "/assurance/review-boards", label: "Review boards" },
    }),
    buildWorkspaceHealthItem({
      id: "assurance-segments",
      area: "assurance",
      label: "Segments",
      status: activeSegmentCount === 0 ? "not_configured" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:segments",
      detail: `${activeSegmentCount} active segment${activeSegmentCount === 1 ? "" : "s"} available for assurance workflows.`,
      primaryAction: { href: "/assurance/segments", label: "Review segments" },
    }),
    buildWorkspaceHealthItem({
      id: "assurance-autopilot",
      area: "assurance",
      label: "Autopilot",
      status: failedAutopilotRunCount > 0 ? "needs_attention" : blockedAutopilotRunCount > 0 ? "delayed" : enabledAutopilotCount === 0 ? "not_configured" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:autopilot",
      userImpact: failedAutopilotRunCount > 0 ? `${failedAutopilotRunCount} autopilot run${failedAutopilotRunCount === 1 ? "" : "s"} failed.` : undefined,
      detail: `${enabledAutopilotCount} enabled rule${enabledAutopilotCount === 1 ? "" : "s"}; ${blockedAutopilotRunCount} blocked run${blockedAutopilotRunCount === 1 ? "" : "s"}; ${failedAutopilotRunCount} failed.`,
      primaryAction: { href: "/assurance/autopilot", label: "Review autopilot" },
    }),
    buildWorkspaceHealthItem({
      id: "assurance-program-evolution",
      area: "assurance",
      label: "Program evolution",
      status: runningProgramEvolutionCount > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:program_evolution",
      detail: `${runningProgramEvolutionCount} experiment${runningProgramEvolutionCount === 1 ? "" : "s"} currently running.`,
      primaryAction: { href: "/assurance/program-evolution", label: "Review evolution" },
    }),
    buildWorkspaceHealthItem({
      id: "assurance-health-graph",
      area: "assurance",
      label: "Health graph",
      status: healthGraphNodeCount === 0 ? "not_configured" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:health_graph",
      detail: `${healthGraphNodeCount} health graph node${healthGraphNodeCount === 1 ? "" : "s"} in recent activity.`,
      primaryAction: { href: "/assurance/health-graph", label: "Review health graph" },
    }),
    buildWorkspaceHealthItem({
      id: "assurance-reports",
      area: "assurance",
      label: "Assurance reports",
      status: failedReportPackCount > 0 ? "needs_attention" : runningReportPackCount > 0 ? "delayed" : "healthy",
      visibility: "user",
      modes: ["assurance"],
      requiredFeature: "assurance:outcome_intelligence",
      userImpact: failedReportPackCount > 0 ? `${failedReportPackCount} assurance report pack${failedReportPackCount === 1 ? "" : "s"} failed.` : undefined,
      detail: `${runningReportPackCount} report pack${runningReportPackCount === 1 ? "" : "s"} queued or running; ${failedReportPackCount} failed.`,
      primaryAction: { href: "/reports", label: "Review assurance reports" },
      chips: [
        { label: "Running", value: String(runningReportPackCount) },
        { label: "Failed", value: String(failedReportPackCount) },
      ],
    }),
  ];
  const userItems = filterWorkspaceHealthItems(healthItems, mode, "user", hiddenFeatures);
  const affectedItems = userItems.filter((item) => item.status !== "healthy");
  const healthyItems = userItems.filter((item) => item.status === "healthy");
  const overallStatus = getOverallWorkspaceHealthStatus(userItems);
  const affectedCount = getAffectedWorkspaceHealthCount(userItems);
  const primaryAction = affectedItems.find((item) => item.primaryAction)?.primaryAction ?? {
    href: "/settings",
    label: "Open settings",
  };
  const primaryAffectedItem = affectedItems[0] ?? null;
  const secondaryAffectedItems = affectedItems.filter((item) => item.id !== primaryAffectedItem?.id);
  const lastCheckedLabel = formatIsoMinute(nowIso) ?? nowIso.slice(0, 16);
  const allClearSentence =
    "No failed, blocked, overdue, or delayed workspace workflows are visible for this mode.";
  const heroCtaLabel =
    overallStatus === "not_configured" && primaryAffectedItem?.id === "automated-recovery"
      ? "Configure recovery worker"
      : primaryAction.label;
  const reportMetadataLabel = hasActiveReportIssue
    ? "Reports need attention"
    : hasReportRunSample
      ? "Reports clear"
      : "No report sample";
  const deliveryMetadataLabel = hasActiveDeliveryIssue
    ? "Deliveries need attention"
    : hasDeliverySample
      ? "Deliveries clear"
      : "No delivery sample";
  const healthyItemsWithDetails = healthyItems.filter(hasUsefulHealthyDetail);
  const additionalHealthyCount = healthyItems.length - healthyItemsWithDetails.length;

  const failedTypeCounts = new Map<string, number>();
  const failureSignatureCounts = new Map<string, number>();
  for (const row of (failedTypesRes.data ?? []) as FailedDeliveryRow[]) {
    const type = String(row.notification_type ?? "unknown");
    failedTypeCounts.set(type, (failedTypeCounts.get(type) ?? 0) + 1);
    const signature = String(row.last_error ?? "unknown")
      .replace(/^\[terminal\]\s*/i, "")
      .slice(0, 120);
    failureSignatureCounts.set(signature, (failureSignatureCounts.get(signature) ?? 0) + 1);
  }
  const topFailedTypes = [...failedTypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topFailureSignatures = [...failureSignatureCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const recentFailedDeliveries = ((failedTypesRes.data ?? []) as FailedDeliveryRow[]).slice(0, 6).map((row) => {
    const metadata =
      (row.metadata as
        | {
            retry_payload?: {
              to?: string;
              channel?: string;
              kind?: string;
            };
          }
        | null) ?? null;
    const retryPayload = metadata?.retry_payload ?? null;
    const target =
      retryPayload?.to ||
      retryPayload?.channel ||
      (retryPayload?.kind === "slack_workflow" ? "Slack workflow" : "Workspace recipient");
    return {
      id: `${row.notification_type}-${row.created_at}-${target}`,
      type: humanize(row.notification_type ?? "unknown"),
      kind: humanize(retryPayload?.kind ?? row.notification_type ?? "delivery"),
      target,
      createdAt: row.created_at,
      error: String(row.last_error ?? "Unknown delivery error"),
    };
  });

  return (
    <div className="ui-page-stack-dense mx-auto max-w-6xl">
      <Link
        href="/settings"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        Back to settings
      </Link>

      {/* Flat page identity — no card. The workspace-status hero below is the focal surface. */}
      <DashboardPageHeader
        icon={<HeartPulse className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Internal settings"
        title="System health"
        lead="Workflow reliability, delivery status, and configuration issues for this workspace."
        actions={
          <dl className="flex shrink-0 items-baseline gap-1.5 pt-1 text-[11px]">
            <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Checked
            </dt>
            <dd className="font-mono text-[var(--text-secondary)]">{lastCheckedLabel}</dd>
          </dl>
        }
      />

      <section
        id="workspace-health-status"
        aria-labelledby="workspace-health-headline"
        className="ui-card-hero relative overflow-hidden px-5 py-6 sm:px-7 md:px-9 md:py-8"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          style={{
            background:
              overallStatus === "healthy"
                ? "linear-gradient(180deg, color-mix(in oklab, var(--success-ink) 80%, transparent) 0%, color-mix(in oklab, var(--success-ink) 20%, transparent) 100%)"
                : overallStatus === "blocked" || overallStatus === "needs_attention"
                  ? "linear-gradient(180deg, color-mix(in oklab, var(--danger-ink) 80%, transparent) 0%, color-mix(in oklab, var(--danger-ink) 20%, transparent) 100%)"
                  : overallStatus === "delayed" || overallStatus === "not_configured"
                    ? "linear-gradient(180deg, color-mix(in oklab, var(--warning-ink) 80%, transparent) 0%, color-mix(in oklab, var(--warning-ink) 20%, transparent) 100%)"
                    : "linear-gradient(180deg, color-mix(in oklab, var(--border-contrast) 70%, transparent) 0%, color-mix(in oklab, var(--border-contrast) 20%, transparent) 100%)",
          }}
        />
        <div className="relative flex min-w-0 gap-4 sm:gap-5">
          <span className={heroMedallionClass(overallStatus)}>
            <HeroStatusIcon status={overallStatus} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Workspace status
              </p>
              <span aria-hidden className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block" />
              <StatusBadge status={workspaceSemanticStatus(overallStatus)}>
                {visibleStatusLabel(overallStatus)}
              </StatusBadge>
            </div>
            <h2
              id="workspace-health-headline"
              className="mt-3 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.01em] text-[var(--text-primary)] sm:text-[2.125rem] md:text-[2.4rem]"
            >
              {workspaceStatusHeadline(primaryAffectedItem)}
            </h2>
            <p className="mt-3 max-w-[42rem] text-[14px] leading-[1.6] text-[var(--text-secondary)]">
              {heroNarrativeText(primaryAffectedItem, allClearSentence)}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2">
              <Link
                href={primaryAction.href}
                className="ui-btn-primary min-h-10 px-4 py-2.5 text-[12.5px]"
              >
                <span>{affectedCount === 0 ? "Inspect health" : heroCtaLabel}</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#support"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Inspect diagnostics
                <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </a>
            </div>
          </div>
        </div>

        {/* At-a-glance footer: two prominent numeric cells. Reports/Deliveries status moved into the
            Support diagnostics summary where it's more actionable. */}
        <dl
          aria-label="Workspace health overview"
          className="relative mt-7 grid grid-cols-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] pt-5 sm:divide-x sm:divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]"
        >
          <div className="pr-5 sm:pr-8">
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <span
                aria-hidden
                className="inline-flex h-2 w-2 rounded-full"
                style={{
                  background:
                    affectedCount === 0
                      ? "var(--success-ink)"
                      : overallStatus === "blocked" || overallStatus === "needs_attention"
                        ? "var(--danger-ink)"
                        : "var(--warning-ink)",
                  boxShadow: `0 0 0 3px color-mix(in oklab, ${
                    affectedCount === 0
                      ? "var(--success-soft)"
                      : overallStatus === "blocked" || overallStatus === "needs_attention"
                        ? "var(--danger-soft)"
                        : "var(--warning-soft)"
                  } 42%, transparent)`,
                }}
              />
              Needs action
            </dt>
            <dd className="mt-2 flex items-baseline gap-2">
              <span
                className="text-[2.25rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
                style={{
                  color:
                    affectedCount === 0
                      ? "var(--success-ink)"
                      : overallStatus === "blocked" || overallStatus === "needs_attention"
                        ? "var(--danger-ink)"
                        : "var(--warning-ink)",
                }}
              >
                {affectedCount}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                of {affectedCount + healthyItems.length}
              </span>
            </dd>
          </div>
          <div className="pl-5 sm:pl-8">
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <span
                aria-hidden
                className="inline-flex h-2 w-2 rounded-full bg-[var(--success-ink)]"
                style={{ boxShadow: "0 0 0 3px color-mix(in oklab, var(--success-soft) 42%, transparent)" }}
              />
              Workflows clear
            </dt>
            <dd className="mt-2 flex items-baseline gap-2">
              <span className="text-[2.25rem] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--success-ink)]">
                {healthyItems.length}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                of {affectedCount + healthyItems.length}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {retryableImportJob || latestFailedReportId ? (
        <section
          className="rounded-lg border border-l-[0.25rem] border-[color:var(--border-card)] border-l-[color:var(--warning-ink)] bg-[var(--surface)] px-3 py-3"
          aria-labelledby="direct-recovery-actions"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="ui-eyebrow">Retry available</p>
              <h2 id="direct-recovery-actions" className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                Direct recovery actions
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {retryableImportJob ? <ImportJobRetryButton jobId={String(retryableImportJob.id)} /> : null}
              {latestFailedReportId ? (
                <V10JobRetryButton
                  url={`/api/report-runs/${encodeURIComponent(latestFailedReportId)}/retry`}
                  label="Retry report"
                  successFallbackMessage="Report retry completed."
                  testId="report-retry"
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {secondaryAffectedItems.length > 0 ? (
        <section className="space-y-3">
          <div>
            <p className="ui-eyebrow">Workflow health</p>
            <h2 className="ui-section-title">Other workflow issues</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {secondaryAffectedItems.map((item) => (
              <OperationalQueueRow
                key={item.id}
                href={item.primaryAction?.href ?? primaryAction.href}
                eyebrow={statusLabel(item.status)}
                title={item.label}
                hint={item.detail ?? item.userImpact ?? statusLabel(item.status)}
                chips={item.chips}
                actionLabel={item.primaryAction?.label ?? primaryAction.label}
                tone={healthItemTone(item)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {healthyItems.length > 0 ? (
        <details id="healthy-workflow-checks" className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 border-y border-[color:var(--border-card)] py-3 outline-none transition-colors marker:hidden hover:border-[color:color-mix(in_oklab,var(--success)_18%,var(--border-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_32%,var(--surface-raised))] text-[var(--success-ink)]">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            <span className="tabular-nums">{healthyItems.length}</span> workflow check{healthyItems.length === 1 ? "" : "s"} clear
          </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 group-open:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="py-3 pl-10">
            <ul className="flex flex-col divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
              {healthyItemsWithDetails.map((item) => (
                <HealthCheckRow key={item.id} item={item} />
              ))}
              {additionalHealthyCount > 0 ? (
                <li className="flex items-center gap-3 py-2 text-[12.5px] text-[var(--text-tertiary)]">
                  <span
                    className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[color:color-mix(in_oklab,var(--success-ink)_55%,var(--border-contrast))]"
                    aria-hidden
                  />
                  <span>
                    +<span className="font-mono tabular-nums">{additionalHealthyCount}</span> additional workflow check{additionalHealthyCount === 1 ? "" : "s"} clear
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        </details>
      ) : null}

      <details id="support" className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 border-y border-[color:var(--border-card)] py-3 outline-none transition-colors marker:hidden hover:border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]">
            <Activity className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
              Support diagnostics
            </span>
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" aria-hidden />
                <span>{reportMetadataLabel}</span>
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Send className="h-3 w-3" aria-hidden />
                <span>{deliveryMetadataLabel}</span>
              </span>
            </span>
          </div>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 group-open:rotate-90"
            aria-hidden
          />
        </summary>
        <div className="py-4 pl-10">
          <span id="v10-runtime" className="sr-only" aria-hidden="true" />
          <span id="mutations" className="sr-only" aria-hidden="true" />
          <span id="artifacts" className="sr-only" aria-hidden="true" />
          <span id="providers" className="sr-only" aria-hidden="true" />
          <span id="canary" className="sr-only" aria-hidden="true" />
          <span id="rollback" className="sr-only" aria-hidden="true" />
          <SettingsHealthDiagnosticsSections
            retryQueueDepth={retryQueueDepth}
            pendingDeliveries={pendingDeliveries}
            retryingDeliveries={retryingDeliveries}
            failedDeliveries={failedDeliveries}
            suppressedDeliveries={suppressedDeliveries}
            webhookPending={webhookPending}
            webhookHighAttempts={webhookHighAttempts}
            retryRunAgeMinutes={retryRunAgeMinutes}
            lastRetryRunAt={lastRetryRunAt}
            reportSuccessRateRecent={reportSuccessRateRecent}
            reportRunsSucceededCount={reportRunsSucceeded.length}
            reportRunsRunningCount={reportRunsRunning.length}
            failedReportRuns={failedReportRuns}
            deliverySuccessRateRecent={deliverySuccessRateRecent}
            deliveredRecent={deliveredRecent}
            failedRecent={failedRecent}
            latestSucceededReportAt={latestSucceededReportAt}
            latestFailedReportAt={latestFailedReportAt}
            topFailedTypes={topFailedTypes}
            topFailureSignatures={topFailureSignatures}
            recentFailedDeliveries={recentFailedDeliveries}
            cronAuditEvents={operationalEventsRes.data ?? []}
          />
        </div>
      </details>
    </div>
  );
}
