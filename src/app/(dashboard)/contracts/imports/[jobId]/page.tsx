import Link from "next/link";
import { ArrowLeft, Check, UploadCloud } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { ActionChip } from "@/components/ui/action-chip";
import { ImportJobRetryButton } from "@/components/contracts/import-job-retry-button";
import { importJobBadge } from "@/lib/import-job-badge";
import {
  getImportJobDetail,
  getImportJobHeadline,
  importJobCanRetry,
} from "@/lib/import-job-visibility";

export const metadata = { title: "Import job" };

const ROWS_LIMIT = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/contracts/bulk#recent-imports"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        Back to import
      </Link>
      <section className="ui-card-raised rounded-2xl p-6">
        <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Contract import</p>
        <h1 className="mt-1 text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)]">
          Import job not found
        </h1>
        <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-[var(--text-secondary)]">
          This import job does not exist in your workspace, or it may have been removed.
        </p>
        <ActionChip verb="Back to import" href="/contracts/bulk#recent-imports" className="mt-4" />
      </section>
    </div>
  );
}

// §2.11 metric cell. "Need correction" at zero is an all-clear outcome, not a
// data hole, so it earns a muted-success check medallion + muted-success
// number rather than a greyed-out treatment.
function SummaryStat({
  label,
  value,
  tone,
  zeroAllClear,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning";
  zeroAllClear?: boolean;
}) {
  const isClear = !!zeroAllClear && value === 0;
  const ink =
    isClear || tone === "success"
      ? "var(--success-ink)"
      : tone === "warning"
        ? "var(--warning-ink)"
        : "var(--text-tertiary)";
  const dotBg = isClear ? "color-mix(in oklab, var(--success-ink) 60%, transparent)" : ink;
  const numberColor = isClear
    ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
    : tone === "neutral"
      ? "var(--text-primary)"
      : ink;
  return (
    <div className="py-3 first:pt-0 last:pb-0 sm:py-0 sm:px-4 sm:first:pl-0">
      <dt className="flex items-center gap-2 ui-caps-2 text-[10px] text-[var(--text-tertiary)]">
        <span
          aria-hidden
          className="inline-flex h-2 w-2 shrink-0 rounded-full"
          style={{
            background: dotBg,
            boxShadow: `0 0 0 3px color-mix(in oklab, ${dotBg} 26%, transparent)`,
          }}
        />
        {label}
      </dt>
      <dd className="mt-2 flex items-center gap-2">
        {isClear ? (
          <span
            aria-hidden
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: "color-mix(in oklab, var(--success-ink) 28%, var(--border-card))",
              background: "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
              color: "var(--success-ink)",
            }}
          >
            <Check className="h-3 w-3" strokeWidth={2.2} />
          </span>
        ) : null}
        <span
          className="text-[1.75rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
          style={{ color: numberColor }}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

export default async function ImportJobPage(props: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await props.params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">No organization found.</p>
      </div>
    );
  }

  if (!UUID_RE.test(jobId)) return <NotFound />;

  const { data: job } = await ctx.admin
    .from("contract_import_jobs")
    .select(
      "id, status, source, total_rows, valid_rows, inserted_rows, error_rows, failure_reason, retry_of_job_id, superseded_by_job_id, created_at, updated_at, completed_at"
    )
    .eq("id", jobId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (!job) return <NotFound />;

  // Core-safe per-row read: only the row index, the user's own title, the row
  // status, and the human-readable correction message — no stored row blobs,
  // internal ids, upstream error categories, or job-runner internals.
  const { data: rowData } = await ctx.admin
    .from("contract_import_job_rows")
    .select("row_index, title, status, error_message")
    .eq("job_id", jobId)
    .eq("organization_id", ctx.orgId)
    .order("row_index", { ascending: true })
    .limit(ROWS_LIMIT);

  const rows = rowData ?? [];
  const errorRows = rows.filter((row) => row.status === "error");
  const insertedRows = job.inserted_rows ?? 0;
  const errorCount = job.error_rows ?? errorRows.length;
  const totalRows = job.total_rows ?? rows.length;
  const rowsTruncated = totalRows > rows.length;

  const badge = importJobBadge(job);
  const detailLead = getImportJobDetail(job)
    .split(String.fromCharCode(0xb7))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(". ");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link
        href="/contracts/bulk#recent-imports"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        Back to import
      </Link>

      <DashboardPageHeader
        icon={<UploadCloud className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Contract import"
        title={getImportJobHeadline(job)}
        lead={detailLead}
        density="default"
        actionsAlign="center"
        titleSuffix={
          <StatusBadge status={badge.status} className="ml-2">
            {badge.label}
          </StatusBadge>
        }
        metaStrip={
          <TimeChip date={job.created_at} format="calendar" bordered className="self-center" />
        }
        actions={
          <>
            {importJobCanRetry(job) ? <ImportJobRetryButton jobId={job.id} /> : null}
            {insertedRows > 0 ? (
              <ActionChip verb="Review imported contracts" href="/contracts" />
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Summary stat card — left rail on wide viewports, full-width below. */}
        <section className="ui-card-raised rounded-2xl p-5 sm:p-6 lg:col-span-1">
          <dl className="flex flex-col sm:flex-row sm:divide-x sm:divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] lg:flex-col lg:divide-x-0 lg:divide-y lg:divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] [&>div:not(:first-child)]:border-t [&>div:not(:first-child)]:border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] sm:[&>div]:border-t-0 lg:[&>div]:border-t-0">
            <SummaryStat label="Rows in file" value={totalRows} tone="neutral" />
            <SummaryStat label="Created" value={insertedRows} tone="success" />
            <SummaryStat
              label="Need correction"
              value={errorCount}
              tone="warning"
              zeroAllClear
            />
          </dl>
        </section>

        {/* Corrections — the operational payload, given the wider main column. */}
        <div className="min-w-0 lg:col-span-2">
          {errorCount === 0 ? (
            <section className="ui-card-quiet flex items-center gap-3 rounded-2xl p-5">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  borderColor: "color-mix(in oklab, var(--success-ink) 26%, var(--border-card))",
                  background: "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
                  color: "var(--success-ink)",
                }}
              >
                <Check className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="ui-caps-2 text-[10.5px] text-[var(--success-ink)]">All rows imported</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-secondary)]">
                  No corrections needed.
                </p>
              </div>
            </section>
          ) : (
            <section className="ui-card-quiet rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="ui-caps-2 text-[11px] text-[var(--text-secondary)]">Rows that need correction</p>
                <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">{errorCount}</span>
              </div>
              {errorRows.length > 0 ? (
                <>
                  {/* Reserved columns: row index, contract title, problem. */}
                  <div className="mt-3 hidden grid-cols-[3.5rem_minmax(0,14rem)_minmax(0,1fr)] gap-x-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pb-1.5 sm:grid">
                    <span className="ui-caps-3 text-[9.5px] text-[var(--text-tertiary)]">Row</span>
                    <span className="ui-caps-3 text-[9.5px] text-[var(--text-tertiary)]">Contract</span>
                    <span className="ui-caps-3 text-[9.5px] text-[var(--text-tertiary)]">Needs</span>
                  </div>
                  <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
                    {errorRows.map((row) => (
                      <li
                        key={row.row_index}
                        className="grid gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[3.5rem_minmax(0,14rem)_minmax(0,1fr)] sm:items-baseline"
                      >
                        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
                          Row {row.row_index + 1}
                        </span>
                        <span className="min-w-0 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                          {row.title?.trim() || "Untitled row"}
                        </span>
                        <span className="min-w-0 text-[11.5px] leading-snug text-[var(--warning-ink)]">
                          {row.error_message ?? "This row could not be created."}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {rowsTruncated ? (
                    <p className="mt-3 text-[11px] tabular-nums text-[var(--text-tertiary)]">
                      Showing the first {rows.length} of {totalRows} rows; more rows needing correction may be beyond this list.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-[12px] leading-snug text-[var(--text-secondary)]">
                  The rows needing correction are beyond the first {rows.length} rows shown here. Use Retry to re-run the failed rows.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
