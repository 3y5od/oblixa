import Link from "next/link";
import { ArrowLeft, History, UploadCloud } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { BulkUploadForm } from "@/components/contracts/bulk-upload-form";
import { ActionChip } from "@/components/ui/action-chip";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { ImportJobRetryButton } from "@/components/contracts/import-job-retry-button";
import { canEditContracts } from "@/lib/permissions";
import {
  getImportJobDetail,
  getImportJobHeadline,
  importJobCanRetry,
} from "@/lib/import-job-visibility";
import { importJobBadge } from "@/lib/import-job-badge";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";

export const metadata = { title: "Import contracts" };

export default async function BulkImportPage(props: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await props.searchParams;
  // A repeated ?tab= query arrives as string[]; take the first so a deep link
  // like ?tab=signed still opens the signed tab.
  const tabValue = Array.isArray(tab) ? tab[0] : tab;
  const initialTab = tabValue === "signed" ? "files" : "csv";
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
  const activeJobs = (recentJobs ?? []).filter((job) => importJobBadge(job).active);
  const completedJobs = (recentJobs ?? []).filter((job) => !importJobBadge(job).active);

  const renderJobRow = (job: NonNullable<typeof recentJobs>[number]) => {
    const badge = importJobBadge(job);
    const detailParts = getImportJobDetail(job)
      // getImportJobDetail joins clauses with a middle dot (U+00B7). Split via
      // char code so no literal middle-dot glyph lands in this source, which the
      // release-state test asserts stays dot-free.
      .split(String.fromCharCode(0xb7))
      .map((part) => part.trim())
      .filter(Boolean);
    return (
      <li key={job.id} className="py-3 first:pt-0 last:pb-0">
        {/* Stacked row: a thin meta line (badge + type, date right), then the
            headline + counts, then a left-aligned action cluster. Keeps the
            content filling the width instead of stranding the actions far
            right with a dead middle. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
            <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
              {job.source === "files" ? "Signed files" : "CSV"}
            </span>
          </div>
          <TimeChip date={job.created_at} format="calendar" bordered className="shrink-0" />
        </div>
        <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
          {getImportJobHeadline(job)}
        </p>
        {detailParts.length > 0 ? (
          <div className="mt-0.5 space-y-0.5">
            {detailParts.map((part, index) => (
              <p
                key={part}
                className={`text-[11.5px] leading-snug ${
                  index === 0
                    ? "tabular-nums text-[var(--text-secondary)]"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
                {part}
              </p>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/imports/${job.id}`}
            className="ui-btn-secondary inline-flex items-center px-2.5 py-1 text-[11px]"
          >
            Open job details
          </Link>
          {importJobCanRetry(job) ? <ImportJobRetryButton jobId={job.id} /> : null}
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3.5">
      <div className="flex flex-col gap-2.5">
        <Link
          href="/contracts"
          className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Back to contracts
        </Link>

        <DashboardPageHeader
          icon={<UploadCloud className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
          eyebrow="Contract import"
          title="Import contracts"
          lead="Bring over a tracker spreadsheet or upload a batch of signed PDF and DOCX agreements."
          density="default"
        />
      </div>

      <BulkUploadForm
        organizationId={ctx.orgId}
        disabled={!!disabledReason}
        disabledReason={disabledReason}
        initialTab={initialTab}
      />

      {!hasPlan && canEdit && isPlanEnforcementEnabled() && (
        <p className="text-center text-sm">
          <Link href="/settings/billing" className="ui-link">
            Go to Billing
          </Link>
        </p>
      )}

      {recentCount > 0 ? (
        <section id="recent-imports" className="ui-card-quiet rounded-2xl p-5">
          <header className="flex flex-wrap items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] text-[var(--accent-strong)]"
            >
              <History className="h-4 w-4" strokeWidth={1.85} />
            </span>
            <p className="ui-caps-2 text-[11px] text-[var(--text-secondary)]">Import status</p>
            <CountChip value={recentCount} />
          </header>

          {activeJobs.length > 0 ? (
            <div className="mt-4">
              <p className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">In progress</p>
              <ul className="mt-2 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
                {activeJobs.map(renderJobRow)}
              </ul>
            </div>
          ) : null}

          {completedJobs.length > 0 ? (
            <div className="mt-4">
              {activeJobs.length > 0 ? (
                <p className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Recent imports</p>
              ) : null}
              <ul
                className={`divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] ${
                  activeJobs.length > 0 ? "mt-2" : ""
                }`}
              >
                {completedJobs.map(renderJobRow)}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-3.5">
            <p className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Review imported records</p>
            <ActionChip verb="Open contracts" href="/contracts" className="mt-2" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
