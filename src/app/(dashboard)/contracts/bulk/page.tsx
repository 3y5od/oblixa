import Link from "next/link";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { BulkUploadForm } from "@/components/contracts/bulk-upload-form";
import { ActionChip } from "@/components/ui/action-chip";
import { CountChip } from "@/components/ui/count-chip";
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

export const metadata = { title: "Import contracts" };

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/contracts"
        className="inline-flex max-w-max items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
        Back to contracts
      </Link>

      <DashboardPageHeader
        icon={<UploadCloud className="h-4 w-4" strokeWidth={1.85} />}
        eyebrow="Contract import"
        title="Import contracts"
        lead="Bring in a tracking spreadsheet or a batch of signed PDF and DOCX agreements."
        density="compact"
      />

      <BulkUploadForm
        organizationId={ctx.orgId}
        disabled={!!disabledReason}
        disabledReason={disabledReason}
      />

      {!hasPlan && canEdit && isPlanEnforcementEnabled() && (
        <p className="text-center text-sm">
          <Link href="/settings/billing" className="ui-link">
            Go to Billing
          </Link>
        </p>
      )}

      {recentCount > 0 ? (
        <section id="recent-imports" className="space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="ui-eyebrow">Import status</p>
            <CountChip value={recentCount} />
          </div>

          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]">
            {recentJobs?.map((job) => {
              const tone = getImportJobTone(job);
              const toneInk =
                tone === "risk"
                  ? "var(--danger-ink)"
                  : tone === "attention"
                    ? "var(--warning-ink)"
                    : tone === "healthy"
                      ? "var(--success-ink)"
                      : "var(--text-tertiary)";
              return (
                <li key={job.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-flex h-1.5 w-1.5 rounded-full"
                      style={{
                        background: toneInk,
                        boxShadow: `0 0 0 3px color-mix(in oklab, ${toneInk} 28%, transparent)`,
                      }}
                    />
                    <span className="ui-caps-2" style={{ color: toneInk }}>
                      {job.source === "files" ? "Signed files" : "CSV import"}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                    {getImportJobHeadline(job)}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-tertiary)]">
                    {getImportJobDetail(job)}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    {formatDateTime(job.created_at)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <a
                      className="ui-link text-[11.5px]"
                      href={`/api/import/contracts/${job.id}`}
                    >
                      Open job details
                    </a>
                    {importJobCanRetry(job) ? (
                      <ImportJobRetryButton jobId={job.id} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div>
            <p className="ui-eyebrow">Review imported records</p>
            <ActionChip
              verb="Open contracts"
              href="/contracts"
              className="mt-2"
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
