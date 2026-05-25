import Link from "next/link";
import { ArrowUpRight, BarChart3, Download } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { UiSelect } from "@/components/ui/ui-select";
import { UiTabs } from "@/components/ui/ui-tabs";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import {
  buildReportsHref,
  loadReportsPageModel,
} from "@/lib/reports/model";
import {
  REPORT_CONTENT_LABELS,
  REPORT_FILTER_LABELS,
  REPORTS_EMPTY_STATE,
  REPORTS_PAGE_TITLE,
  REPORTS_PARTIAL_DATA_REASON,
  REPORTS_PARTIAL_DATA_TITLE,
} from "@/lib/reports/spec-strings";
import type { ReportFilterState, ReportsPageModel } from "@/lib/reports/types";

export const metadata = { title: REPORTS_PAGE_TITLE };

type ReportsPageSearchParams = {
  report?: string | string[];
  family?: string | string[];
  window?: string | string[];
  owner?: string | string[];
  counterparty?: string | string[];
  status?: string | string[];
};

export default async function ReportsPage(props: {
  searchParams: Promise<ReportsPageSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const model = await loadReportsPageModel(ctx.admin, ctx.orgId, {
    userId: ctx.user.id,
    role: ctx.role,
    workspaceMode: productSurface.mode,
    report: firstParam(searchParams.report),
    family: firstParam(searchParams.family),
    window: firstParam(searchParams.window),
    owner: firstParam(searchParams.owner),
    counterparty: firstParam(searchParams.counterparty),
    status: firstParam(searchParams.status),
  });

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<BarChart3 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.eyebrow}
        title={REPORTS_PAGE_TITLE}
        actions={
          <Link
            href={model.exportHref}
            className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2"
          >
            <Download className="h-4 w-4" aria-hidden />
            {model.primaryCta}
          </Link>
        }
      />

      {model.warnings.length > 0 ? (
        // Compact density: this is an edge-state notice (data freshness
        // hiccup) — it should be visible but shouldn't dominate the page
        // above the actual report content. Reason text + action link
        // already convey the recoverability; the standard-density card
        // was over-prominent for a transient partial-data state.
        <RecoverableState
          state="partial"
          density="compact"
          title={REPORTS_PARTIAL_DATA_TITLE}
          reason={REPORTS_PARTIAL_DATA_REASON}
          accessibleName="Reports partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link href="/settings/health" className="ui-link">
              Review workspace health
            </Link>
          }
        />
      ) : null}

      <section className="ui-card overflow-hidden p-0" aria-labelledby="reports-surface-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
          <div className="space-y-1">
            <p className="ui-caps-2 text-[var(--text-tertiary)]">Core exports</p>
            <h2 id="reports-surface-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {model.activeDefinition.label}
            </h2>
            <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
              {model.activeDefinition.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Link href="/contracts" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5">
              All contracts
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </div>
        </div>

        <UiTabs
          ariaLabel="Reports"
          items={model.reports.map((report) => ({
            href: report.href,
            label: report.label,
            active: report.active,
            count: report.count,
          }))}
          className="px-5"
        />

        <ReportsFilters model={model} />

        <ReportPreviewTable model={model} />
      </section>
    </div>
  );
}

function ReportsFilters({ model }: { model: ReportsPageModel }) {
  const clearHref = buildReportsHref({ report: model.activeReport });
  const hasFilters = hasActiveFilters(model.filters);

  return (
    <form
      action="/reports"
      className="grid gap-3 px-5 py-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
      aria-label={REPORT_CONTENT_LABELS.filters}
    >
      <input type="hidden" name="report" value={model.activeReport} />
      <FilterSelect
        label={REPORT_FILTER_LABELS.window}
        name="window"
        value={model.filters.window}
        options={model.filterOptions.windows}
      />
      <FilterSelect
        label={REPORT_FILTER_LABELS.owner}
        name="owner"
        value={model.filters.owner}
        options={model.filterOptions.owners}
      />
      <FilterSelect
        label={REPORT_FILTER_LABELS.counterparty}
        name="counterparty"
        value={model.filters.counterparty}
        options={model.filterOptions.counterparties}
      />
      <FilterSelect
        label={REPORT_FILTER_LABELS.status}
        name="status"
        value={model.filters.status}
        options={model.filterOptions.statuses}
      />
      <div className="flex items-end gap-2">
        <button type="submit" className="ui-btn-secondary px-4 py-2">
          Apply
        </button>
        {hasFilters ? (
          <Link href={clearHref} className="ui-btn-ghost px-3 py-2 text-[12.5px]">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: ReportsPageModel["filterOptions"]["windows"];
}) {
  return (
    <label className="block min-w-0 space-y-2 text-[12.5px] font-medium text-[var(--text-secondary)]">
      <span>{label}</span>
      <UiSelect
        className="block w-full"
        buttonClassName="w-full"
        name={name}
        defaultValue={value}
        options={options}
        ariaLabel={label}
      />
    </label>
  );
}

function ReportPreviewTable({ model }: { model: ReportsPageModel }) {
  // Match the row's grid-template-columns to the header's so column cells
  // align vertically across header + every row. The previous template
  // (auto-fit minmax(11rem, 1fr)) could yield a different column count than
  // the header (which uses a fixed N), producing misalignment at certain
  // widths.
  const gridTemplate = `repeat(${model.previewColumns.length}, minmax(0, 1fr))`;
  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="ui-caps-2 text-[var(--text-tertiary)]">{REPORT_CONTENT_LABELS.previewTable}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Spec §Reports.eachReportShouldInclude — "Last generated
              timestamp" rendered as caps eyebrow + value chip so the
              chip's uppercase styling doesn't double-uppercase the value
              (the previous all-in-one chip produced an awkward "LAST
              GENERATED Never generated" caps-then-mixed-case fragment). */}
          <div className="flex items-center gap-1.5">
            <p className="ui-caps-2 text-[var(--text-tertiary)]">Last generated</p>
            <span className="ui-chip">
              <span className="font-mono normal-case tracking-normal">
                {model.lastGeneratedLabel}
              </span>
            </span>
          </div>
          <span className="ui-chip">
            <span className="font-mono tabular-nums">{model.totalPreviewRows}</span>
            <span className="ml-1">rows</span>
          </span>
        </div>
      </div>
      {model.previewRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-5 py-8 text-center text-sm text-[var(--text-secondary)]">
          {REPORTS_EMPTY_STATE}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_86%,transparent)]">
          <div
            className="hidden gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,transparent)] px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] lg:grid"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {model.previewColumns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]">
            {model.previewRows.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 px-4 py-4 text-sm text-[var(--text-secondary)] lg:items-center"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {model.previewColumns.map((column, index) => {
                  const rawValue = row.cells[column];
                  const isEmpty = !rawValue || rawValue.trim().length === 0;
                  const value = isEmpty ? "—" : rawValue;
                  const isPrimary = index === 0;
                  return (
                    <div key={`${row.id}-${column}`} className="min-w-0 space-y-1">
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] lg:hidden">
                        {column}
                      </p>
                      {isPrimary && row.href ? (
                        <Link href={row.href} className="ui-link font-semibold text-[var(--accent-strong)]">
                          {value}
                        </Link>
                      ) : (
                        <p
                          className={
                            isPrimary
                              ? "font-semibold text-[var(--text-primary)]"
                              : isEmpty
                                ? "text-[var(--text-tertiary)]"
                                : ""
                          }
                        >
                          {value}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {model.totalPreviewRows > model.previewRows.length ? (
        <p className="mt-3 text-[12.5px] text-[var(--text-tertiary)]">
          Preview limited to {model.previewRows.length} rows. Use {model.primaryCta} for the full CSV.
        </p>
      ) : null}
    </div>
  );
}

function hasActiveFilters(filters: ReportFilterState) {
  return filters.window !== "90" || Boolean(filters.owner || filters.counterparty || filters.status);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
