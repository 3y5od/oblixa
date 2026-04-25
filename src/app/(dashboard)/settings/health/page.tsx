import { AlertTriangle, Clock, Inbox, Percent, PlugZap, FileWarning } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalQueueRow, OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { getOrgMemberRole } from "@/lib/permissions";
import { hasRoleCapability } from "@/lib/access-control";
import {
  getImportJobDetail,
  getImportJobHeadline,
  getImportJobTone,
} from "@/lib/import-job-visibility";
import { getExportJobDetail, getExportJobHeadline, getExportJobTone } from "@/lib/export-job-visibility";
import { isExtractionProcessingStale } from "@/lib/extraction/constants";

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
        <p className="ui-page-lead mt-3 max-w-xl">
          You do not have permission to view operational health details for this workspace.
        </p>
      </div>
    );
  }

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

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Admin</p>
          <h1 className="ui-display-title mt-2">System health transparency</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            Operational status across notifications, webhook delivery retries, and report execution.
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

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Pipelines</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Workflow reliability visibility</h2>
        </div>
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
          <OperationalQueueRow
            href="/contracts"
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
