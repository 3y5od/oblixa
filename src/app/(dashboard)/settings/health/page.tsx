import { AlertTriangle, Clock, Inbox, Percent, PlugZap, FileWarning } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalQueueRow, OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { getOrgMemberRole } from "@/lib/permissions";
import { hasRoleCapability } from "@/lib/access-control";
import {
  getImportJobDetail,
  getImportJobHeadline,
  getImportJobTone,
} from "@/lib/import-job-visibility";
import { getExportJobDetail, getExportJobHeadline, getExportJobTone } from "@/lib/export-job-visibility";
import { isExtractionProcessingStale } from "@/lib/extraction/constants";
import { buildV10SettingsHealthDiagnostics } from "@/lib/v10-governance";
import { applyV10ReadModelVisibility } from "@/lib/v10-visibility";
import { V10_OPS_RELEASE_READINESS_CONTRACTS } from "@/lib/v10-operational-contracts";

export const metadata = { title: "System health" };

export default async function SettingsHealthPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, user } = ctx;

  const [role, workflowSettingsRes] = await Promise.all([
    getOrgMemberRole(admin, user.id, orgId),
    admin
      .from("organization_workflow_settings")
      .select("role_policy_json")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);
  const canOpenHealth = hasRoleCapability({
    role,
    capability: "settings_manage",
    rolePolicyJson: (workflowSettingsRes.data?.role_policy_json as Record<string, unknown> | null) ?? null,
  });
  if (!canOpenHealth) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="ui-eyebrow">Workspace</p>
        <h1 className="ui-display-title mt-2">System health</h1>
        <V10RecoverableState
          state="forbidden"
          title="System health is restricted"
          reason="You do not have permission to view operational health details for this workspace."
          accessibleName="System health access restricted"
          noActionExplanation="Ask a workspace admin to grant settings access or open a support-safe diagnostic from another authorized account."
          className="mt-6 max-w-xl"
        />
      </div>
    );
  }

  const nowIso = new Date().toISOString();
  const [
    webhookRes,
    reportRunsRes,
    cronAuditRes,
    pendingRes,
    retryingRes,
    failedRes,
    suppressedRes,
    importJobsRes,
    exportJobsRes,
    extractionJobsRes,
    v10JobRowsRes,
    v10ReportRowsRes,
    v10RefreshJobsRes,
    v10CoverageRowsRes,
    v10ArtifactRowsRes,
    v10IdempotencyBacklogRes,
    v10ExpiredIdempotencyClaimsRes,
    v10PostGaBlockersRes,
  ] =
    await Promise.all([
      admin
        .from("outbound_event_deliveries")
        .select("delivered, attempt_count, next_attempt_at, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("report_runs")
        .select("status, started_at")
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
          "status, total_rows, inserted_rows, error_rows, failure_reason, updated_at, completed_at, retry_of_job_id, superseded_by_job_id, created_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("contract_export_jobs")
        .select(
          "status, selected_contract_count, exported_rows, truncated, error_message, created_at, completed_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("contract_extraction_jobs")
        .select("status, attempt_count, last_error, started_at, completed_at")
        .eq("organization_id", orgId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(50),
      applyV10ReadModelVisibility(
        admin
          .from("v10_job_run_visibility")
          .select("job_id, job_class, status, failure_category, diagnostic_id, user_visible_detail, retry_action, completed_count, failed_count, retryable_count, started_at, completed_at"),
        { organizationId: orgId, role, includeWorkspaceMode: false }
      )
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(8),
      applyV10ReadModelVisibility(
        admin
          .from("v10_report_run_visibility")
          .select("report_run_id, report_family, status, failure_category, diagnostic_id, retry_action, started_at, completed_at"),
        { organizationId: orgId, role, includeWorkspaceMode: false }
      )
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(8),
      admin
        .from("v10_read_model_refresh_jobs")
        .select("refresh_job_id, refresh_reason, status, failure_count, failed_source_tables, diagnostic_id, started_at, completed_at, updated_at")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(6),
      admin
        .from("v10_runtime_coverage_ledger")
        .select("coverage_key, coverage_kind, priority, owner, runtime_status, test_status, freshness_state, residual_risk, updated_at")
        .or(`organization_id.is.null,organization_id.eq.${orgId}`)
        .order("updated_at", { ascending: false })
        .limit(12),
      applyV10ReadModelVisibility(
        admin
          .from("v10_runtime_artifacts")
          .select("artifact_key, artifact_kind, classification, access_scope, evidence_key, diagnostic_id, expires_at, revoked_at, updated_at"),
        { organizationId: orgId, role, includeWorkspaceMode: false }
      )
        .order("updated_at", { ascending: false })
        .limit(8),
      admin
        .from("v10_mutation_idempotency")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("claim_status", "in_progress"),
      admin
        .from("v10_mutation_idempotency")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("claim_status", "in_progress")
        .not("claim_expires_at", "is", null)
        .lt("claim_expires_at", nowIso),
      admin
        .from("v10_external_blocker_records")
        .select("blocker_key, blocker_reason, evidence_kind, status")
        .eq("organization_id", orgId)
        .in("status", ["release_check_required", "candidate"])
        .or("evidence_kind.eq.operational_slo_window,evidence_kind.eq.post_ga_dashboard,blocker_key.ilike.%post_ga%")
        .order("updated_at", { ascending: false })
        .limit(12),
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
  const reportRuns = reportRunsRes.data ?? [];
  const reportRunsFailed = reportRuns.filter((run) => run.status === "failed");
  const reportRunsSucceeded = reportRuns.filter((run) => run.status === "succeeded");
  const reportRunsRunning = reportRuns.filter((run) => run.status === "running");
  const deliverySuccessRateRecent =
    deliveredRecent + failedRecent === 0 ? 100 : (deliveredRecent / (deliveredRecent + failedRecent)) * 100;
  const webhookPending = (webhookRes.data ?? []).filter((d) => !d.delivered).length;
  const webhookHighAttempts = (webhookRes.data ?? []).filter((d) => Number(d.attempt_count ?? 0) >= 3).length;
  const failedReportRuns = reportRunsFailed.length;
  const reportSuccessRateRecent =
    reportRunsSucceeded.length + reportRunsFailed.length === 0
      ? 100
      : (reportRunsSucceeded.length / (reportRunsSucceeded.length + reportRunsFailed.length)) * 100;
  const latestFailedReportAt = reportRunsFailed[0]?.started_at ?? null;
  const latestSucceededReportAt = reportRunsSucceeded[0]?.started_at ?? null;
  const importJobs = importJobsRes.data ?? [];
  const exportJobs = exportJobsRes.data ?? [];
  const extractionJobs = extractionJobsRes.data ?? [];
  const latestImportJob = importJobs[0] ?? null;
  const latestExportJob = exportJobs[0] ?? null;
  const latestExtractionJob = extractionJobs[0] ?? null;
  const v10JobRows = v10JobRowsRes.data ?? [];
  const v10ReportRows = v10ReportRowsRes.data ?? [];
  const v10RefreshJobs = v10RefreshJobsRes.data ?? [];
  const v10CoverageRows = v10CoverageRowsRes.data ?? [];
  const v10ArtifactRows = v10ArtifactRowsRes.data ?? [];
  const v10IdempotencyBacklog = v10IdempotencyBacklogRes.count ?? 0;
  const v10ExpiredIdempotencyClaims = v10ExpiredIdempotencyClaimsRes.count ?? 0;
  const v10PostGaBlockerRows = v10PostGaBlockersRes.data ?? [];
  const postGaOperationalSloMisses = v10PostGaBlockerRows.map((row) => {
    const key = String(row.blocker_key ?? "");
    const evidenceKind = String(row.evidence_kind ?? "");
    const window: "7d" | "30d" =
      key.includes("30_day") || key.includes("30d") || evidenceKind.includes("30") ? "30d" : "7d";
    return {
      window,
      sloKey: key || "post_ga_operational_slo",
      observedSummary: String(
        row.blocker_reason ?? "External blocker requires owner mitigation before SLO debt widens."
      ),
    };
  });
  const v10RetryableJobs = v10JobRows.filter((row) => row.retry_action);
  const v10RetryableReports = v10ReportRows.filter((row) => row.retry_action);
  const latestV10RefreshJob = v10RefreshJobs[0] ?? null;
  const v10FailedOrPartialRefreshJobs = v10RefreshJobs.filter((row) =>
    ["partial", "failed_retryable", "failed_terminal"].includes(String(row.status))
  );
  const v10CoverageBlockers = v10CoverageRows.filter((row) =>
    ["external_blocker", "environment_gated", "release_check_required"].includes(String(row.runtime_status))
  );
  const v10StaleCoverageRows = v10CoverageRows.filter((row) =>
    ["stale", "partial", "failed", "missing"].includes(String(row.freshness_state))
  );
  const v10RevokedArtifacts = v10ArtifactRows.filter((row) => row.revoked_at);
  const failedImportJobs = importJobs.filter((job) => job.status === "failed").length;
  const partialImportJobs = importJobs.filter(
    (job) => job.status !== "failed" && Number(job.error_rows ?? 0) > 0
  ).length;
  const processingImportJobs = importJobs.filter((job) => job.status === "processing").length;
  const failedExportJobs = exportJobs.filter((job) => job.status === "failed").length;
  const limitedExportJobs = exportJobs.filter(
    (job) => job.status === "partial" || Boolean(job.truncated)
  ).length;
  const activeExportJobs = exportJobs.filter(
    (job) => job.status === "queued" || job.status === "processing"
  ).length;
  const failedExtractionJobs = extractionJobs.filter((job) => job.status === "failed").length;
  const staleExtractionJobs = extractionJobs.filter(
    (job) => job.status === "processing" && isExtractionProcessingStale(job.started_at)
  ).length;
  const activeExtractionJobs = extractionJobs.filter(
    (job) => job.status === "pending" || job.status === "processing"
  ).length;
  const latestImportHeadline = latestImportJob ? getImportJobHeadline(latestImportJob) : "No recent imports";
  const latestImportDetail = latestImportJob
    ? getImportJobDetail(latestImportJob)
    : "No recent import jobs are recorded yet.";
  const latestImportTone = latestImportJob ? getImportJobTone(latestImportJob) : "neutral";
  const latestExportHeadline = latestExportJob ? getExportJobHeadline(latestExportJob) : "No recent exports";
  const latestExportDetail = latestExportJob
    ? getExportJobDetail(latestExportJob)
    : "No recent export jobs are recorded yet.";
  const latestExportTone = !latestExportJob ? "neutral" : getExportJobTone(latestExportJob);
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
  const latestExtractionTone =
    !latestExtractionJob
      ? "neutral"
      : latestExtractionJob.status === "failed"
        ? "risk"
        : latestExtractionJob.status === "processing" &&
            isExtractionProcessingStale(latestExtractionJob.started_at)
          ? "risk"
          : latestExtractionJob.status === "processing" || latestExtractionJob.status === "pending"
            ? "attention"
            : "healthy";
  const lastRetryRunAt =
    (cronAuditRes.data ?? []).find((evt) => evt.action === "notifications.retry_deliveries_run")?.created_at ?? null;
  const referenceTimestamps = [
    (webhookRes.data ?? [])[0]?.created_at,
    (cronAuditRes.data ?? [])[0]?.created_at,
    (reportRunsRes.data ?? [])[0]?.started_at,
  ].filter((v): v is string => Boolean(v));
  const referenceMs =
    referenceTimestamps.length > 0
      ? Math.max(...referenceTimestamps.map((v) => new Date(v).getTime()).filter((ms) => Number.isFinite(ms)))
      : null;
  const retryRunAgeMinutes =
    lastRetryRunAt && referenceMs != null
      ? Math.max(0, Math.round((referenceMs - new Date(lastRetryRunAt).getTime()) / 60_000))
      : null;
  const alerts: string[] = [];
  if (retryQueueDepth >= 25) alerts.push(`Notification retry queue is elevated (${retryQueueDepth}).`);
  if (failedDeliveries >= 10) alerts.push(`High failed notification volume in recent samples (${failedDeliveries}).`);
  if (deliverySuccessRateRecent < 90) {
    alerts.push(`Recent notification delivery success rate is low (${deliverySuccessRateRecent.toFixed(1)}%).`);
  }
  if (failedReportRuns >= 3) alerts.push(`Recent report delivery failures are elevated (${failedReportRuns}).`);
  if (failedReportRuns > 0 && reportRunsSucceeded.length === 0) {
    alerts.push("Recent report samples show failures without a successful digest recovery yet.");
  }
  if (failedImportJobs > 0) alerts.push(`Recent contract imports failed (${failedImportJobs}).`);
  if (partialImportJobs > 0) {
    alerts.push(`Recent contract imports completed with row-level corrections still needed (${partialImportJobs}).`);
  }
  if (failedExportJobs > 0) alerts.push(`Recent contract exports failed (${failedExportJobs}).`);
  if (limitedExportJobs > 0) alerts.push(`Recent contract exports completed with limits (${limitedExportJobs}).`);
  if (failedExtractionJobs > 0) alerts.push(`Recent extraction runs failed (${failedExtractionJobs}).`);
  if (staleExtractionJobs > 0) alerts.push(`Some extraction jobs appear stale or stuck (${staleExtractionJobs}).`);
  if (v10FailedOrPartialRefreshJobs.length > 0) {
    alerts.push(`Data freshness refresh has partial or failed runs (${v10FailedOrPartialRefreshJobs.length}).`);
  }
  if (v10CoverageBlockers.length > 0) {
    alerts.push(`V10 runtime coverage has unresolved release blockers (${v10CoverageBlockers.length}).`);
  }
  if (v10ExpiredIdempotencyClaims > 0) {
    alerts.push(`V10 mutation idempotency has expired in-progress claims (${v10ExpiredIdempotencyClaims}).`);
  } else if (v10IdempotencyBacklog >= 10) {
    alerts.push(`V10 mutation idempotency backlog is elevated (${v10IdempotencyBacklog}).`);
  }
  const v10SettingsHealthDiagnostics = buildV10SettingsHealthDiagnostics({
    failedJobCount: v10RetryableJobs.length + v10RetryableReports.length,
    staleReadModelCount: v10FailedOrPartialRefreshJobs.length + v10StaleCoverageRows.length,
    notificationFailureCount: failedDeliveries,
    releaseBlockerCount: v10CoverageBlockers.length,
    postGaOperationalSloMisses,
  });
  for (const diagnostic of v10SettingsHealthDiagnostics) {
    if (!alerts.includes(diagnostic.userVisibleSummary)) alerts.push(diagnostic.userVisibleSummary);
  }
  if (lastRetryRunAt == null) alerts.push("Retry worker has no recorded heartbeat.");
  if (retryRunAgeMinutes != null && retryRunAgeMinutes > 30) {
    alerts.push(`Retry worker heartbeat appears stale (${retryRunAgeMinutes} minutes behind activity).`);
  }
  const failedTypeCounts = new Map<string, number>();
  const failureSignatureCounts = new Map<string, number>();
  for (const row of failedTypesRes.data ?? []) {
    const type = String(row.notification_type ?? "unknown");
    failedTypeCounts.set(type, (failedTypeCounts.get(type) ?? 0) + 1);
    const signature = String(row.last_error ?? "unknown")
      .replace(/^\[terminal\]\s*/i, "")
      .slice(0, 120);
    failureSignatureCounts.set(signature, (failureSignatureCounts.get(signature) ?? 0) + 1);
  }
  const topFailedTypes = [...failedTypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topFailureSignatures = [...failureSignatureCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const recentFailedDeliveries = (failedTypesRes.data ?? []).slice(0, 6).map((row) => {
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
    const kind = String(retryPayload?.kind ?? row.notification_type ?? "delivery").replace(/_/g, " ");
    return {
      id: `${row.notification_type}-${row.created_at}-${target}`,
      type: String(row.notification_type ?? "unknown").replace(/_/g, " "),
      kind,
      target,
      createdAt: row.created_at,
      error: String(row.last_error ?? "Unknown delivery error"),
    };
  });
  type UserVisibleImpactRow = {
    href: string;
    eyebrow: string;
    title: string;
    hint: string;
    actionLabel: string;
    tone: "neutral" | "attention" | "risk";
  };
  const userVisibleImpactCandidates: Array<UserVisibleImpactRow | null> = [
    retryQueueDepth > 0
      ? {
          href: "/settings/operations",
          eyebrow: "Notifications",
          title: "Reminder and digest emails may arrive late",
          hint: `${retryQueueDepth} delivery item${retryQueueDepth === 1 ? " is" : "s are"} still pending or retrying across the workspace.`,
          actionLabel: "Check delivery operations",
          tone: retryQueueDepth >= 25 ? ("risk" as const) : ("attention" as const),
        }
      : null,
    failedReportRuns > 0
      ? {
          href: "/contracts/reports",
          eyebrow: "Reports",
          title: "Scheduled summaries may be incomplete or missing",
          hint:
            latestFailedReportAt != null
              ? `Latest failed run started ${new Date(latestFailedReportAt).toISOString()}. Review report history before sharing status externally.`
              : `${failedReportRuns} recent report run${failedReportRuns === 1 ? " has" : "s have"} failed.`,
          actionLabel: "Open report history",
          tone: failedReportRuns >= 3 ? ("risk" as const) : ("attention" as const),
        }
      : null,
    webhookPending > 0 || webhookHighAttempts > 0
      ? {
          href: "/settings/operations",
          eyebrow: "Integrations",
          title: "Connected systems may be stale",
          hint: `${webhookPending} outbound delivery sample${webhookPending === 1 ? " is" : "s are"} undelivered and ${webhookHighAttempts} have needed 3+ attempts.`,
          actionLabel: "Inspect integrations",
          tone: webhookHighAttempts > 0 ? ("attention" as const) : ("neutral" as const),
        }
      : null,
    failedImportJobs > 0 || partialImportJobs > 0 || processingImportJobs > 0
      ? {
          href: "/contracts/bulk#recent-imports",
          eyebrow: "Imports",
          title: latestImportHeadline,
          hint: latestImportDetail,
          actionLabel: "Open import history",
          tone: failedImportJobs > 0 ? ("risk" as const) : ("attention" as const),
        }
      : null,
    failedExportJobs > 0 || limitedExportJobs > 0 || activeExportJobs > 0
      ? {
          href: "/contracts",
          eyebrow: "Exports",
          title: latestExportHeadline,
          hint: latestExportDetail,
          actionLabel: "Open contract exports",
          tone: failedExportJobs > 0 ? ("risk" as const) : ("attention" as const),
        }
      : null,
    failedExtractionJobs > 0 || staleExtractionJobs > 0 || activeExtractionJobs > 0
      ? {
          href: "/contracts/review",
          eyebrow: "Extraction",
          title: latestExtractionHeadline,
          hint: latestExtractionDetail,
          actionLabel: "Open review and extraction follow-up",
          tone:
            failedExtractionJobs > 0 || staleExtractionJobs > 0
              ? ("risk" as const)
              : ("attention" as const),
        }
      : null,
  ];
  const userVisibleImpacts = userVisibleImpactCandidates.filter(
    (row): row is UserVisibleImpactRow => Boolean(row)
  );
  const routeHealthRows: UserVisibleImpactRow[] = [
    {
      href: "/work?lens=failed_jobs",
      eyebrow: "Work recovery",
      title:
        v10RetryableJobs.length + v10RetryableReports.length > 0
          ? "Retryable recovery work is visible"
          : "No retryable recovery rows",
      hint:
        v10JobRows.length + v10ReportRows.length > 0
          ? `${v10JobRows.length} job visibility row${v10JobRows.length === 1 ? "" : "s"} and ${v10ReportRows.length} report visibility row${v10ReportRows.length === 1 ? "" : "s"} are materialized.`
          : "No job/report visibility rows are materialized; refresh or source job coverage may be missing.",
      actionLabel: "Open failed-job lens",
      tone: v10JobRows.length + v10ReportRows.length > 0 ? "neutral" : "attention",
    },
    {
      href: "/settings/health#read-models",
      eyebrow: "Data freshness",
      title:
        latestV10RefreshJob == null
          ? "No V10 refresh job recorded"
          : ["partial", "failed_retryable", "failed_terminal"].includes(String(latestV10RefreshJob.status))
            ? "Latest V10 refresh needs attention"
            : "Latest V10 refresh is recorded",
      hint:
        latestV10RefreshJob == null
          ? "Home, Work, contract detail, command search, reports, and health cards need a refresh job record before release evidence can promote."
          : `${String(latestV10RefreshJob.refresh_reason).replace(/_/g, " ")} finished with status ${String(latestV10RefreshJob.status).replace(/_/g, " ")} and ${Number(latestV10RefreshJob.failure_count ?? 0)} failure${Number(latestV10RefreshJob.failure_count ?? 0) === 1 ? "" : "s"}.`,
      actionLabel: "Review freshness",
      tone:
        latestV10RefreshJob == null ||
        ["partial", "failed_retryable", "failed_terminal"].includes(String(latestV10RefreshJob.status))
          ? "attention"
          : "neutral",
    },
    {
      href: "/settings/product",
      eyebrow: "Configuration",
      title: lastRetryRunAt == null ? "Retry worker heartbeat missing" : "Retry worker heartbeat recorded",
      hint:
        lastRetryRunAt == null
          ? "Notification and reminder recovery needs a configured worker heartbeat before GA evidence can be promoted."
          : `Latest retry worker heartbeat: ${new Date(lastRetryRunAt).toISOString()}.`,
      actionLabel: "Open product settings",
      tone: lastRetryRunAt == null ? "attention" : "neutral",
    },
    {
      href: "/settings/health#v10-idempotency",
      eyebrow: "Mutations",
      title:
        v10ExpiredIdempotencyClaims > 0
          ? "Expired mutation claims need cleanup"
          : v10IdempotencyBacklog > 0
            ? "Mutation claims are in progress"
            : "No in-progress mutation backlog",
      hint:
        v10ExpiredIdempotencyClaims > 0
          ? `${v10ExpiredIdempotencyClaims} in-progress claim${v10ExpiredIdempotencyClaims === 1 ? "" : "s"} passed claim expiry and should be cleaned up by the V10 idempotency cron.`
          : `${v10IdempotencyBacklog} in-progress idempotency claim${v10IdempotencyBacklog === 1 ? "" : "s"} currently protects duplicate V10 mutations.`,
      actionLabel: "Review mutation health",
      tone: v10ExpiredIdempotencyClaims > 0 ? "attention" : "neutral",
    },
  ];

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header-compact">
        <div>
          <p className="ui-eyebrow">Admin</p>
          <h1 className="ui-page-title-compact mt-2">System health</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            User-visible trust, failed automation, report delivery, and data freshness issues appear before diagnostics.
          </p>
        </div>
      </header>

      {alerts.length > 0 && (
        <section className="ui-status-panel ui-status-panel-warning">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--warning-ink)]">Attention needed</p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.map((alert) => (
              <li key={alert}>- {alert}</li>
            ))}
          </ul>
        </section>
      )}

      {userVisibleImpacts.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className="ui-eyebrow">Visible impact</p>
            <h2 className="ui-page-title mt-2 text-[1.8rem]">What workspace users may notice</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {userVisibleImpacts.map((row) => (
              <OperationalQueueRow
                key={`${row.eyebrow}-${row.title}`}
                href={row.href}
                eyebrow={row.eyebrow}
                title={row.title}
                hint={row.hint}
                actionLabel={row.actionLabel}
                tone={row.tone}
              />
            ))}
          </div>
        </section>
      )}

      {postGaOperationalSloMisses.length > 0 ? (
        <section
          id="v10-post-ga-slo"
          className="ui-page-shell overflow-hidden"
          aria-labelledby="v10-post-ga-slo-title"
        >
          <div className="ui-surface-tint px-5 py-3">
            <p className="ui-eyebrow">Post-GA operations</p>
            <h2 id="v10-post-ga-slo-title" className="ui-section-title mt-1 text-base">
              Operational SLO windows need attention
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Per the V10 release contract post-GA operational SLO policy, misses surface here until production dashboards and mitigations are recorded.
            </p>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {postGaOperationalSloMisses.map((miss) => (
              <li key={`${miss.window}-${miss.sloKey}`} className="px-5 py-4 text-sm">
                <p className="font-semibold text-[var(--text-primary)]">
                  {miss.window === "7d" ? "7-day" : "30-day"} window · {miss.sloKey}
                </p>
                <p className="mt-1 text-[var(--text-secondary)]">{miss.observedSummary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="read-models" className="space-y-3">
        <div>
          <p className="ui-eyebrow">Route health</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Recoverable destinations and configuration gaps</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {routeHealthRows.map((row) => (
            <OperationalQueueRow
              key={`${row.eyebrow}-${row.title}`}
              href={row.href}
              eyebrow={row.eyebrow}
              title={row.title}
              hint={row.hint}
              actionLabel={row.actionLabel}
              tone={row.tone}
            />
          ))}
        </div>
      </section>

      <section id="jobs" className="space-y-3">
        <span id="v10-runtime" className="sr-only">
          V10 runtime operations
        </span>
        <div>
          <p className="ui-eyebrow">V10 runtime</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Data freshness and coverage ledger</h2>
        </div>
        {latestV10RefreshJob == null ? (
          <V10RecoverableState
            state="empty"
            title="No V10 refresh job has been recorded"
            reason="The runtime tables may be empty or the refresh worker has not written its diagnostic job row yet."
            accessibleName="V10 data freshness refresh missing"
            nextAction={
              <a className="ui-button ui-button-secondary" href="/api/contracts/recompute-signals">
                Recompute signals
              </a>
            }
            nextActionLabel="Recompute signals"
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            <OperationalQueueRow
              href="/settings/health#read-models"
              eyebrow="Refresh"
              title={String(latestV10RefreshJob.status).replace(/_/g, " ")}
              hint={`${String(latestV10RefreshJob.refresh_reason).replace(/_/g, " ")} · ${Number(latestV10RefreshJob.failure_count ?? 0)} failure${Number(latestV10RefreshJob.failure_count ?? 0) === 1 ? "" : "s"} · ${latestV10RefreshJob.completed_at ? new Date(latestV10RefreshJob.completed_at).toISOString() : "not completed"}`}
              actionLabel="Review refresh state"
              tone={v10FailedOrPartialRefreshJobs.length > 0 ? "attention" : "neutral"}
            />
            <OperationalQueueRow
              href="/settings/health#coverage-ledger"
              eyebrow="Coverage"
              title={
                v10CoverageBlockers.length > 0
                  ? `${v10CoverageBlockers.length} release blocker${v10CoverageBlockers.length === 1 ? "" : "s"}`
                  : "No sampled blockers"
              }
              hint={`${v10CoverageRows.length} sampled coverage row${v10CoverageRows.length === 1 ? "" : "s"} with ${v10StaleCoverageRows.length} stale, partial, failed, or missing freshness state${v10StaleCoverageRows.length === 1 ? "" : "s"}.`}
              actionLabel="Review coverage ledger"
              tone={v10CoverageBlockers.length > 0 || v10StaleCoverageRows.length > 0 ? "attention" : "neutral"}
            />
            <OperationalQueueRow
              href="/settings/health#runtime-artifacts"
              eyebrow="Artifacts"
              title={`${v10ArtifactRows.length} sampled support artifact${v10ArtifactRows.length === 1 ? "" : "s"}`}
              hint={`${v10RevokedArtifacts.length} revoked artifact${v10RevokedArtifacts.length === 1 ? "" : "s"} in the latest sample. Classifications remain support-safe on this surface.`}
              actionLabel="Review artifacts"
              tone={v10RevokedArtifacts.length > 0 ? "attention" : "neutral"}
            />
            <OperationalQueueRow
              href="/settings/health#v10-idempotency"
              eyebrow="Idempotency"
              title={
                v10ExpiredIdempotencyClaims > 0
                  ? `${v10ExpiredIdempotencyClaims} expired claim${v10ExpiredIdempotencyClaims === 1 ? "" : "s"}`
                  : `${v10IdempotencyBacklog} in-progress claim${v10IdempotencyBacklog === 1 ? "" : "s"}`
              }
              hint="Duplicate mutation protection is visible here without exposing request payloads or private object data."
              actionLabel="Review mutation backlog"
              tone={v10ExpiredIdempotencyClaims > 0 ? "attention" : "neutral"}
            />
          </div>
        )}
        {(v10CoverageRows.length > 0 || v10ArtifactRows.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            <section id="coverage-ledger" className="ui-page-shell overflow-hidden">
              <div className="ui-surface-tint px-5 py-3">
                <p className="ui-eyebrow">Coverage ledger</p>
                <h3 className="ui-section-title mt-1 text-base">Sampled release-impact rows</h3>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {v10CoverageRows.slice(0, 6).map((row) => (
                  <li key={`${row.coverage_kind}:${row.coverage_key}`} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--text-primary)]">{String(row.coverage_key).replace(/_/g, " ")}</p>
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                        {String(row.runtime_status).replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {String(row.coverage_kind).replace(/_/g, " ")} · owner {String(row.owner)} · freshness{" "}
                      {String(row.freshness_state).replace(/_/g, " ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section id="runtime-artifacts" className="ui-page-shell overflow-hidden">
              <div className="ui-surface-tint px-5 py-3">
                <p className="ui-eyebrow">Runtime artifacts</p>
                <h3 className="ui-section-title mt-1 text-base">Support-safe artifact state</h3>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {v10ArtifactRows.slice(0, 6).map((row) => (
                  <li key={`${row.artifact_kind}:${row.artifact_key}`} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--text-primary)]">{String(row.artifact_key).replace(/_/g, " ")}</p>
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                        {String(row.classification).replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {String(row.artifact_kind).replace(/_/g, " ")} · {String(row.access_scope).replace(/_/g, " ")}
                      {row.diagnostic_id ? ` · Diagnostic ${row.diagnostic_id}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Release operations</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Runbooks, providers, canary, and rollback</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            These operator destinations mirror the V10 release-readiness contracts so runbook links, recovery anchors, and support-safe diagnostics stay aligned.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {V10_OPS_RELEASE_READINESS_CONTRACTS.filter((contract) => contract.key !== "read_model_refresh").map((contract) => {
            const anchor = contract.recoveryDestination.split("#")[1] ?? contract.key;
            return (
              <div key={contract.key} id={anchor}>
                <OperationalQueueRow
                  href={contract.recoveryDestination}
                  eyebrow={String(contract.owner)}
                  title={String(contract.key).replace(/_/g, " ")}
                  hint={`${contract.diagnosticPrefix} · ${contract.providerBlockers.length} provider blocker${contract.providerBlockers.length === 1 ? "" : "s"} · ${contract.rollbackCommand}`}
                  actionLabel="Open runbook destination"
                  tone={contract.cronRoute == null ? "attention" : "neutral"}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Pipelines</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Workflow reliability visibility</h2>
        </div>
        {(v10JobRows.length > 0 || v10ReportRows.length > 0) ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="ui-eyebrow">Recovery state</p>
                <h3 className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                  Retry diagnostics from materialized job visibility
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {v10RetryableJobs.length + v10RetryableReports.length} retryable job/report item
                  {v10RetryableJobs.length + v10RetryableReports.length === 1 ? "" : "s"} currently expose a recovery action.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {[...v10JobRows, ...v10ReportRows].slice(0, 6).map((row) => {
                const id = "job_id" in row ? row.job_id : row.report_run_id;
                const label = "job_class" in row ? row.job_class : row.report_family;
                return (
                  <div key={`${label}:${id}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                          {String(label).replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 font-medium text-[var(--text-primary)]">
                          {String(row.status).replace(/_/g, " ")}
                        </p>
                      </div>
                      {row.retry_action ? (
                        <span className="rounded-full bg-[color:color-mix(in_oklab,var(--warning)_14%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--warning-strong)]">
                          {String(row.retry_action).replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      {row.diagnostic_id ? `Diagnostic ${row.diagnostic_id}` : row.failure_category ?? "No diagnostic needed"}
                    </p>
                    {"user_visible_detail" in row && row.user_visible_detail ? (
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{row.user_visible_detail}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-3">
          <OperationalQueueRow
            href="/contracts/bulk#recent-imports"
            eyebrow="Imports"
            title={latestImportHeadline}
            hint={latestImportDetail}
            chips={[
              { label: "Processing", value: String(processingImportJobs) },
              { label: "Failed", value: String(failedImportJobs) },
              { label: "Partial", value: String(partialImportJobs) },
            ]}
            actionLabel="Open import history"
            tone={latestImportTone}
          />
          <div id="exports">
            <OperationalQueueRow
              href="/contracts#exports"
              eyebrow="Exports"
              title={latestExportHeadline}
              hint={latestExportDetail}
              chips={[
                { label: "Active", value: String(activeExportJobs) },
                { label: "Failed", value: String(failedExportJobs) },
                { label: "Limited", value: String(limitedExportJobs) },
              ]}
              actionLabel="Open contract exports"
              tone={latestExportTone}
            />
          </div>
          <OperationalQueueRow
            href="/contracts/review"
            eyebrow="Extraction"
            title={latestExtractionHeadline}
            hint={latestExtractionDetail}
            chips={[
              { label: "Active", value: String(activeExtractionJobs) },
              { label: "Failed", value: String(failedExtractionJobs) },
              { label: "Stale", value: String(staleExtractionJobs) },
            ]}
            actionLabel="Open review and extraction follow-up"
            tone={latestExtractionTone}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Throughput</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Delivery posture</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <OperationalSummaryCard
            eyebrow="Notifications"
            headline="Retry queue depth"
            tone={retryQueueDepth >= 25 ? "attention" : "healthy"}
            icon={Inbox}
            primaryValue={retryQueueDepth}
            primaryUnit="pending + retrying"
            breakdown={[
              { label: "Pending", value: String(pendingDeliveries) },
              { label: "Retrying", value: String(retryingDeliveries) },
              { label: "Failed", value: String(failedDeliveries) },
            ]}
            action={{ href: "/settings/operations", label: "Workspace operations" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Notifications"
            headline="Failed deliveries"
            tone={failedDeliveries >= 10 ? "risk" : failedDeliveries > 0 ? "attention" : "healthy"}
            icon={AlertTriangle}
            primaryValue={failedDeliveries}
            primaryUnit="in sampled window"
            breakdown={[
              { label: "Retrying", value: String(retryingDeliveries) },
              { label: "Suppressed", value: String(suppressedDeliveries) },
            ]}
            action={{ href: "/settings/health", label: "Refresh health" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Webhooks"
            headline="Outbound backlog"
            tone={webhookPending > 0 || webhookHighAttempts > 0 ? "attention" : "healthy"}
            icon={PlugZap}
            primaryValue={webhookPending}
            primaryUnit="undelivered samples"
            breakdown={[{ label: "3+ attempts", value: String(webhookHighAttempts) }]}
            action={{ href: "/settings/operations", label: "Check integrations" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Workers"
            headline="Retry worker lag"
            tone={
              retryRunAgeMinutes != null && retryRunAgeMinutes > 30
                ? "risk"
                : lastRetryRunAt == null
                  ? "attention"
                  : "healthy"
            }
            icon={Clock}
            primaryValue={retryRunAgeMinutes == null ? null : `${retryRunAgeMinutes}m`}
            primaryFallback="Unknown"
            primaryUnit="behind latest activity"
            secondaryLine={
              lastRetryRunAt ? `Last run ${new Date(lastRetryRunAt).toISOString()}` : "No heartbeat recorded yet"
            }
            breakdown={
              retryRunAgeMinutes != null && lastRetryRunAt
                ? [{ label: "Last run", value: new Date(lastRetryRunAt).toISOString().slice(0, 19) }]
                : []
            }
            action={{ href: "/settings/health", label: "View health" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Reports"
            headline="Report run reliability"
            tone={failedReportRuns >= 3 ? "risk" : failedReportRuns > 0 ? "attention" : "healthy"}
            icon={FileWarning}
            primaryValue={`${reportSuccessRateRecent.toFixed(1)}%`}
            primaryUnit="successful runs in recent sample"
            breakdown={[
              { label: "Succeeded", value: String(reportRunsSucceeded.length) },
              { label: "Running", value: String(reportRunsRunning.length) },
              { label: "Failed", value: String(failedReportRuns) },
            ]}
            action={{ href: "/contracts/reports", label: "Open report history" }}
            variant="compact"
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard
          eyebrow="Quality"
          headline="Delivery success (recent)"
          tone={deliverySuccessRateRecent < 90 ? "attention" : "healthy"}
          icon={Percent}
          primaryValue={`${deliverySuccessRateRecent.toFixed(1)}%`}
          primaryUnit="delivered vs failed sample"
          breakdown={[
            { label: "Delivered", value: String(deliveredRecent) },
            { label: "Failed", value: String(failedRecent) },
          ]}
          action={{ href: "/settings/health", label: "Refresh metrics" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Dead letter"
          headline="Recent failures"
          tone={failedRecent > 0 ? "attention" : "healthy"}
          icon={AlertTriangle}
          primaryValue={failedRecent}
          primaryUnit="failed in sample"
          action={{ href: "/settings/health", label: "Review breakdowns" }}
          variant="compact"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard
          eyebrow="Reports"
          headline="Latest successful digest"
          tone={latestSucceededReportAt ? "healthy" : failedReportRuns > 0 ? "attention" : "neutral"}
          icon={Clock}
          primaryValue={latestSucceededReportAt ? new Date(latestSucceededReportAt).toISOString().slice(0, 16) : null}
          primaryFallback="None sampled"
          primaryUnit="most recent successful report run"
          action={{ href: "/contracts/reports", label: "Review report history" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Reports"
          headline="Latest failed digest"
          tone={latestFailedReportAt ? "attention" : "healthy"}
          icon={FileWarning}
          primaryValue={latestFailedReportAt ? new Date(latestFailedReportAt).toISOString().slice(0, 16) : null}
          primaryFallback="No recent failures"
          primaryUnit="most recent failed report run"
          action={{ href: "/contracts/reports", label: "Open report history" }}
          variant="compact"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-page-shell overflow-hidden">
          <div className="ui-surface-tint px-5 py-3">
            <p className="ui-eyebrow">Diagnostics</p>
            <h2 className="ui-section-title mt-1 text-base">Top failed notification types</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {topFailedTypes.length === 0 ? (
              <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No failed delivery types.</li>
            ) : (
              topFailedTypes.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-[var(--text-secondary)]">{type}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="ui-page-shell overflow-hidden">
          <div className="ui-surface-tint px-5 py-3">
            <p className="ui-eyebrow">Diagnostics</p>
            <h2 className="ui-section-title mt-1 text-base">Top failure signatures</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {topFailureSignatures.length === 0 ? (
              <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No failure signatures.</li>
            ) : (
              topFailureSignatures.map(([signature, count]) => (
                <li key={signature} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="truncate text-[var(--text-secondary)]">{signature}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="ui-page-shell overflow-hidden">
        <div className="ui-surface-tint px-5 py-3">
          <p className="ui-eyebrow">Recovery</p>
          <h2 className="ui-section-title mt-1 text-base">Recent failed deliveries</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {recentFailedDeliveries.length === 0 ? (
            <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No recent failed deliveries.</li>
          ) : (
            recentFailedDeliveries.map((row) => (
              <li key={row.id} className="space-y-1 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-[var(--text-primary)]">{row.type}</span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span className="text-[var(--text-secondary)]">{row.kind}</span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span className="text-[var(--text-secondary)]">{row.target}</span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">{new Date(row.createdAt).toISOString()}</p>
                <p className="text-xs text-[var(--text-secondary)]">{row.error}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-page-shell overflow-hidden">
        <div className="ui-surface-tint px-5 py-3">
          <p className="ui-eyebrow">Audit</p>
          <h2 className="ui-section-title mt-1 text-base">Recent operational events</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {(cronAuditRes.data ?? []).length === 0 ? (
            <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No recent events.</li>
          ) : (
            (cronAuditRes.data ?? []).map((evt, idx) => (
              <li key={`${evt.action}-${idx}`} className="px-5 py-3 text-sm">
                <p className="font-medium text-[var(--text-primary)]">{evt.action}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{new Date(evt.created_at).toISOString()}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
