import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, BarChart3, ClipboardList } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { ReportsAdvancedContent } from "./reports-advanced-content";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
import {
  buildReportsControlRoomSummary,
  type ReportRunVisibilityInput,
} from "@/lib/reports-control-room";
import type { ExportJobVisibilityInput } from "@/lib/export-job-visibility";

export const metadata = { title: "Operational reports" };

function ReportsAdvancedFallback() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className="ui-page-header space-y-3">
        <div className="ui-skeleton h-4 w-40 rounded" />
        <div className="ui-skeleton h-10 w-72 rounded" />
        <div className="ui-skeleton h-4 max-w-xl rounded" />
      </div>
      <div className="ui-skeleton h-40 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="ui-skeleton h-36 rounded-2xl" />
        <div className="ui-skeleton h-36 rounded-2xl" />
        <div className="ui-skeleton h-36 rounded-2xl" />
      </div>
    </div>
  );
}

export default async function ReportsControlRoomPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, role } = ctx;
  const productSurface = await loadProductSurfaceContext(admin, orgId, role as WorkspaceRole);
  const { data: controlRoomSnapshot } = await admin.rpc("reports_control_room_snapshot", {
    p_org_id: orgId,
  });
  const snapshot =
    controlRoomSnapshot && typeof controlRoomSnapshot === "object"
      ? (controlRoomSnapshot as Record<string, unknown>)
      : {};
  const reportRuns = (Array.isArray(snapshot.recentReportRuns) ? snapshot.recentReportRuns : []) as ReportRunVisibilityInput[];
  const exportJobs = (Array.isArray(snapshot.recentExportJobs) ? snapshot.recentExportJobs : []) as ExportJobVisibilityInput[];
  const summary = buildReportsControlRoomSummary({
    reportRuns,
    exportJobs,
  });
  if (productSurface.mode === "core") {
    return (
      <div className="ui-page-stack">
        <header className="ui-page-header">
          <div>
            <p className="ui-eyebrow">Reports</p>
            <h1 className="ui-display-title mt-2">Operational reports</h1>
            <p className="ui-page-lead mt-2 max-w-2xl">
              Standard report packs, execution summaries, and workspace-safe reporting entry points.
            </p>
          </div>
          <Link href="/contracts/reports" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Contract report packs
          </Link>
        </header>
        <section
          className={
            summary.reportsNeedAttention
              ? "ui-status-panel ui-status-panel-warning"
              : "ui-status-panel ui-status-panel-success"
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    summary.reportsNeedAttention ? "text-[var(--warning-ink)]" : "text-[var(--success-ink)]"
                  }`}
                  aria-hidden
                />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  Report delivery posture
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {summary.reportsNeedAttention
                  ? "Recent report runs need review before you rely on outbound summaries."
                  : "Recent report samples are delivering normally."}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {summary.failedRunsCount > 0
                  ? `${summary.failedRunsCount} failed, ${summary.runningRunsCount} running, and ${summary.succeededRunsCount} successful report runs in the recent sample.`
                  : `${summary.succeededRunsCount} successful and ${summary.runningRunsCount} running report runs in the recent sample.`}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {summary.latestFailedRunAt
                  ? `Latest failure: ${new Date(summary.latestFailedRunAt).toISOString()}`
                  : summary.latestSucceededRunAt
                    ? `Latest successful sample: ${new Date(summary.latestSucceededRunAt).toISOString()}`
                    : "No recent report samples recorded yet."}
              </p>
              {summary.runningRunsCount > 0 ? (
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]" data-v9-anchor="report-generation-in-progress">
                  Report generation in progress
                  {summary.runningRunsCount > 1 ? ` — ${summary.runningRunsCount} samples still running.` : "."}
                </p>
              ) : null}
              {summary.failedRunsCount > 0 ? (
                <p className="mt-2 text-sm font-semibold text-[var(--warning-ink)]" data-v9-anchor="report-generation-failed">
                  Report generation failed
                  {summary.failedRunsCount > 1 ? ` — ${summary.failedRunsCount} failures in the recent sample.` : "."}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]" data-v9-anchor="export-follow-through-state">
                {summary.latestExportStateLabel}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--text-secondary)]">
                Report outputs and CSV exports use the same workspace mode and hidden-surface suppression as the lists
                or selections you start them from. Truncated or partial exports say so in the download response and in
                export job history.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="ui-support-panel px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Latest report sample
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {summary.failedRunsCount > 0
                      ? "Recent report samples include failures"
                      : summary.runningRunsCount > 0
                        ? "Recent report samples are still running"
                        : "Recent report samples look healthy"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {summary.failedRunsCount} failed · {summary.runningRunsCount} running · {summary.succeededRunsCount} successful
                  </p>
                </div>
                <div
                  className={`px-4 py-3 ${
                    summary.latestExportTone === "risk"
                      ? "ui-status-panel ui-status-panel-risk"
                      : summary.latestExportTone === "attention"
                        ? "ui-status-panel ui-status-panel-warning"
                        : "ui-support-panel"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Latest export follow-through
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{summary.latestExportHeadline}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{summary.latestExportDetail}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <Link href="/contracts/reports" className="ui-btn-secondary px-3 py-2 text-xs">
                Open report history
              </Link>
              <Link href="/settings/health" className="ui-btn-secondary px-3 py-2 text-xs">
                View system health
              </Link>
            </div>
          </div>
        </section>
        <section className="ui-page-shell space-y-4">
          <div>
            <p className="ui-eyebrow">Collections</p>
            <h2 className="ui-page-title mt-2 text-[1.8rem]">Report families</h2>
            <p className="ui-section-lead mt-2">Choose the reporting surface based on whether you need historical runs, recurring ritual review, or system-level delivery diagnostics.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <OperationalSurfaceLinkCard
              href="/contracts/reports"
              eyebrow="Pack"
              title="Contract report packs"
              hint="Portfolio packs, trend views, and operational exports."
              icon={ClipboardList}
              tone="neutral"
            />
            <OperationalSurfaceLinkCard
              href="/contracts/review-cadence"
              eyebrow="Ritual"
              title="Review cadence"
              hint="Weekly and monthly review ritual workspace."
              icon={BarChart3}
              tone="neutral"
            />
            <OperationalSurfaceLinkCard
              href="/settings/health"
              eyebrow="Diagnostics"
              title="System health"
              hint="Delivery diagnostics for report runs, reminders, imports, exports, and extraction reliability."
              icon={AlertTriangle}
              tone={summary.reportsNeedAttention ? "attention" : "neutral"}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <Suspense fallback={<ReportsAdvancedFallback />}>
      <ReportsAdvancedContent
        admin={admin}
        orgId={orgId}
        role={role as WorkspaceRole}
        productSurface={productSurface}
      />
    </Suspense>
  );
}
