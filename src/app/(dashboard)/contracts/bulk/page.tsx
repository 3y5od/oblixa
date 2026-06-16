import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  Inbox,
  Layers,
  Plus,
  UploadCloud,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { BulkUploadForm } from "@/components/contracts/bulk-upload-form";
import { TransformationRail } from "@/components/contracts/transformation-rail";
import { ActionChip } from "@/components/ui/action-chip";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { RatioChip } from "@/components/ui/ratio-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { ImportJobRetryButton } from "@/components/contracts/import-job-retry-button";
import { canEditContracts } from "@/lib/permissions";
import { getImportJobHeadline, importJobCanRetry } from "@/lib/import-job-visibility";
import { importJobBadge, type ImportJobBadge } from "@/lib/import-job-badge";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";

export const metadata = { title: "Import tracker rows" };

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

  type JobRow = NonNullable<typeof recentJobs>[number];
  const jobs = (recentJobs ?? []).map((job) => ({ job, badge: importJobBadge(job) }));
  const recentCount = jobs.length;
  const activeJobs = jobs.filter((entry) => entry.badge.active);
  const completedJobs = jobs.filter((entry) => !entry.badge.active);

  // Summary counts by outcome — four fixed slots (active / partial / ready /
  // failed) so the strip's columns stay stable as jobs change. A zero bucket
  // renders in the neutral tone, never asserting "0 FAILED" in danger red.
  const countLabel = (label: string) =>
    completedJobs.filter((entry) => entry.badge.label === label).length;
  const summary = [
    { key: "active", label: "Active", value: activeJobs.length, tone: undefined },
    { key: "partial", label: "Partial", value: countLabel("Partial"), tone: "warning" as const },
    { key: "ready", label: "Ready", value: countLabel("Ready"), tone: "success" as const },
    { key: "failed", label: "Failed", value: countLabel("Failed"), tone: "danger" as const },
  ];
  const totalImported = jobs.reduce((sum, entry) => sum + (entry.job.inserted_rows ?? 0), 0);

  const renderJobRow = (
    { job, badge }: { job: JobRow; badge: ImportJobBadge },
    active = false
  ) => {
    const inserted = job.inserted_rows ?? 0;
    const total = job.total_rows ?? 0;
    const errors = job.error_rows ?? 0;
    const canRetry = importJobCanRetry(job);
    return (
      // The whole row is the open-job-details target (§8.6): one link, an "Open"
      // chip, and — for retryable jobs — a sibling retry button kept outside the
      // link so the two affordances never nest. Retry reveals on hover/focus on
      // wide screens and stays visible on touch; the active job is tinted.
      <li
        key={job.id}
        className={`group rounded-lg px-2 py-2 transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_32%,transparent)] ${
          active
            ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_20%,transparent)] ring-1 ring-[color:color-mix(in_oklab,var(--accent)_16%,transparent)]"
            : ""
        }`}
      >
        <Link
          href={`/contracts/imports/${job.id}`}
          aria-label="Open job details"
          className="block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
              <span
                aria-hidden
                className="h-3 w-px shrink-0 bg-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]"
              />
              <span className="truncate text-[11px] text-[var(--text-tertiary)]">
                {job.source === "files" ? "Signed files" : "CSV"}
              </span>
            </span>
            <TimeChip date={job.created_at} format="calendar" bordered className="shrink-0" />
          </div>
          <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
            {getImportJobHeadline(job)}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {total > 0 ? (
                <RatioChip
                  numerator={inserted}
                  denominator={total}
                  suffix="contracts created"
                  tone={errors > 0 ? "warning" : inserted > 0 ? "success" : undefined}
                />
              ) : null}
              {errors > 0 ? (
                <KeyValueChip label="Rows to fix" value={errors} tone="warning" />
              ) : null}
            </span>
            <span
              aria-hidden
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--accent-strong)] opacity-40 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Open
              <ChevronRight className="h-2.5 w-2.5" strokeWidth={2} />
            </span>
          </div>
        </Link>
        {canRetry ? (
          <div className="mt-1.5 flex justify-end transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
            <ImportJobRetryButton jobId={job.id} className="rounded-md px-2.5 py-0.5" />
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[72rem]">
      <div className="flex flex-col gap-4">
        <Link
          href="/contracts"
          className="inline-flex max-w-max items-center gap-1.5 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Back to contracts
        </Link>

        <DashboardPageHeader
          icon={<UploadCloud className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
          eyebrow="Contract import"
          title="Import tracker rows"
          titleFont="serif"
          lead="Bring signed-contract tracker rows into Oblixa, then confirm the suggested details before they appear in reminders, tasks, and reports."
          density="default"
          actions={
            <>
              <Link
                href="/contracts/new"
                className="ui-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Upload contract
              </Link>
              <Link
                href="/contracts"
                className="ui-btn-ghost inline-flex items-center px-3 py-1.5 text-[12.5px]"
              >
                View contracts
              </Link>
            </>
          }
        />
      </div>

      {/* Source-to-record transformation (§9): a tracker CSV becomes contract
          records, which then enter Contract Details Review. The shared rail
          frames the whole page; the per-source step path lives inside the form. */}
      <TransformationRail
        className="mt-4"
        nodes={[
          {
            icon: <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
            label: "Tracker CSV",
            caption: "Rows exported from a contract tracker",
          },
          {
            icon: <Layers className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
            label: "Contract records",
            caption: "One record per row, with suggested details",
          },
          {
            icon: <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
            label: "Contract Details Review",
            caption: "Confirm details before they drive reminders and tasks",
          },
        ]}
      />

      {/* Import cockpit: the form is the one focal surface in the main column;
          import status is a calmer companion rail (sticky on wide viewports). */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-3.5">
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
        </div>

        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--shell-topbar-h)+1rem)] lg:self-start">
          <section
            id="recent-imports"
            className="ui-card-quiet rounded-lg p-4"
            aria-label="Import jobs"
          >
            <header className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
              >
                <History className="h-3.5 w-3.5" strokeWidth={1.85} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Import jobs</p>
              {recentCount > 0 ? <CountChip value={recentCount} /> : null}
            </header>

            {recentCount === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-4 py-8 text-center">
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
                >
                  <Inbox className="h-4 w-4" strokeWidth={1.85} />
                </span>
                <p className="text-[12.5px] font-medium text-[var(--text-primary)]">No import jobs yet</p>
                <p className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                  Import results and row corrections appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {summary.map((bucket) => (
                    <KeyValueChip
                      key={bucket.key}
                      label={bucket.label}
                      value={bucket.value}
                      tone={bucket.value > 0 ? bucket.tone : undefined}
                    />
                  ))}
                </div>

                {/* Jobs scroll internally so the review-records action below stays
                    docked at the rail foot even with a long history. */}
                <div className="mt-2 max-h-[26rem] space-y-3 overflow-y-auto">
                  {activeJobs.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-medium text-[var(--text-tertiary)]">In progress</p>
                      <ul className="mt-1.5 space-y-1">
                        {activeJobs.map((entry) => renderJobRow(entry, true))}
                      </ul>
                    </div>
                  ) : null}

                  {completedJobs.length > 0 ? (
                    <div>
                      {activeJobs.length > 0 ? (
                        <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Recent imports</p>
                      ) : null}
                      <ul className={`space-y-1 ${activeJobs.length > 0 ? "mt-1.5" : ""}`}>
                        {completedJobs.map((entry) => renderJobRow(entry))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-3.5">
                  <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Review imported records</p>
                  <div className="mt-2">
                    {totalImported > 0 ? (
                      <ChipCapsule
                        leftValue={totalImported}
                        leftLabel="Imported"
                        rightVerb="Open contracts"
                        href="/contracts"
                      />
                    ) : (
                      <ActionChip verb="Open contracts" href="/contracts" />
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
