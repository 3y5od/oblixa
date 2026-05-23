import Link from "next/link";
import {
  ListChecks,
  UploadCloud,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { BulkUploadForm } from "@/components/contracts/bulk-upload-form";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { ImportJobRetryButton } from "@/components/contracts/import-job-retry-button";
import { canEditContracts } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format-date";
import {
  getImportJobDetail,
  getImportJobHeadline,
  getImportJobTone,
  importJobCanRetry,
} from "@/lib/import-job-visibility";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";

export default async function BulkImportPage() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">No organization found.</p>
      </div>
    );
  }

  const canEdit = canEditContracts(ctx.role as OrgRole);

  const { data: recentJobs } = await ctx.admin
    .from("contract_import_jobs")
    .select(
      "id, source, status, total_rows, inserted_rows, error_rows, failure_reason, retry_of_job_id, superseded_by_job_id, created_at, updated_at, completed_at"
    )
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  /** §4.4 — plan/subscription gate for import only; not used for IA or workspace mode. */
  const hasPlan =
    !isPlanEnforcementEnabled() ||
    (await orgHasActivePlan(ctx.admin, ctx.orgId));

  let disabledReason: string | undefined;
  if (!canEdit) {
    disabledReason =
      "Viewers cannot import contracts. Ask an editor or admin to import files.";
  } else if (!hasPlan) {
    disabledReason =
      "An active subscription is required. Open Billing to subscribe.";
  }

  const recentCount = recentJobs?.length ?? 0;
  const totalInserted = (recentJobs ?? []).reduce(
    (sum, job) => sum + (job.inserted_rows ?? 0),
    0
  );
  const totalErrors = (recentJobs ?? []).reduce(
    (sum, job) => sum + (job.error_rows ?? 0),
    0
  );
  const neutralInk = "text-[var(--text-tertiary)]";
  const importStats: Array<{ label: string; value: number; className: string }> = [
    {
      label: "Jobs",
      value: recentCount,
      className: recentCount === 0 ? neutralInk : "text-[var(--text-primary)]",
    },
    {
      label: "Created",
      value: totalInserted,
      className: totalInserted === 0 ? neutralInk : "text-[var(--success-ink)]",
    },
    {
      label: "Needs fix",
      value: totalErrors,
      className: totalErrors === 0 ? neutralInk : "text-[var(--warning-ink)]",
    },
  ];

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<UploadCloud className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Contract import"
        title="Import contracts"
        actions={
          <Link
            href="/contracts"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            Back to contracts
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
        <section className="min-w-0">
          <BulkUploadForm
            organizationId={ctx.orgId}
            disabled={!!disabledReason}
            disabledReason={disabledReason}
          />
          {!hasPlan && canEdit && isPlanEnforcementEnabled() && (
            <p className="mt-4 text-center text-sm">
              <Link href="/settings/billing" className="ui-link">
                Go to Billing
              </Link>
            </p>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section id="recent-imports" className="ui-card overflow-hidden p-0">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="ui-eyebrow">Import status</p>
                  <h2 className="ui-section-title mt-2 text-[1.05rem]">Recent import jobs</h2>
                </div>
                <Link href="/contracts" className="ui-link shrink-0 text-[12.5px]">
                  Open contracts
                </Link>
              </div>
            </div>

            {recentCount > 0 ? (
              <div className="grid grid-cols-3 border-b border-[var(--border-subtle)] text-center">
                {importStats.map((stat, index) => (
                  <div
                    key={stat.label}
                    className={`px-3 py-3 ${index < 2 ? "border-r border-[var(--border-subtle)]" : ""}`}
                  >
                    <p className="ui-kicker">{stat.label}</p>
                    <p className={`mt-1 text-[1.3rem] font-semibold tabular-nums ${stat.className}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {(recentJobs?.length ?? 0) > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentJobs?.map((job) => {
                  const tone = getImportJobTone(job);
                  const toneClass =
                    tone === "risk"
                      ? "text-[var(--danger-ink)]"
                      : tone === "attention"
                        ? "text-[var(--warning-ink)]"
                        : tone === "healthy"
                          ? "text-[var(--success-ink)]"
                          : "text-[var(--text-tertiary)]";
                  return (
                    <article key={job.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`ui-caps-2 ${toneClass}`}>
                          {job.source === "files" ? "Signed files" : "CSV import"}
                        </span>
                        <span className="ui-chip">{job.status}</span>
                      </div>
                      <h3 className="mt-2 text-[13.5px] font-semibold text-[var(--text-primary)]">
                        {getImportJobHeadline(job)}
                      </h3>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                        {getImportJobDetail(job)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-tertiary)]">
                        <span>Created {formatDateTime(job.created_at)}</span>
                        {job.retry_of_job_id ? <span>Retry attempt</span> : null}
                        {job.completed_at ? <span>Completed {formatDateTime(job.completed_at)}</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <a className="ui-link text-[12px]" href={`/api/import/contracts/${job.id}`}>
                          Open job details
                        </a>
                        {importJobCanRetry(job) ? <ImportJobRetryButton jobId={job.id} /> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-start gap-3 px-5 py-5">
                <span className="ui-icon-tile-compact shrink-0" aria-hidden>
                  <ListChecks className="h-4 w-4" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                    No import jobs yet
                  </p>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
