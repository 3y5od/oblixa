import Link from "next/link";
import { ArrowRight, BarChart3, Download } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { UiSelect } from "@/components/ui/ui-select";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { ReportRail } from "@/components/reports/report-rail";
import { ReportPreviewTable } from "@/components/reports/report-preview-table";
import { REPORT_WINDOWED } from "@/components/reports/report-display";
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
  REPORT_WINDOW_LABELS,
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

  const windowLabel = REPORT_WINDOW_LABELS[model.filters.window];
  const exportScopeWindow = REPORT_WINDOWED.has(model.activeReport) ? windowLabel : undefined;

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<BarChart3 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.eyebrow}
        title={REPORTS_PAGE_TITLE}
        lead={model.lead}
        actions={
          // The export acts on the active report + applied filters. The active
          // report is named in the card body and the window sits in the filter
          // row, so the button no longer needs a top-right scope cluster
          // competing with the page header (issues 4 / 5) — its label and
          // tooltip carry the scope instead.
          <Link
            href={model.exportHref}
            title={`Export ${model.activeDefinition.label}${exportScopeWindow ? ` · ${windowLabel} window` : ""}`}
            aria-label={`Export ${model.activeDefinition.label}${exportScopeWindow ? ` for the ${windowLabel} window` : ""}`}
            className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2"
          >
            <Download className="h-4 w-4" aria-hidden />
            {model.primaryCta}
          </Link>
        }
      />

      {model.warnings.length > 0 ? (
        // Transient data-freshness notice. The `ui-status-panel-quiet` modifier
        // drops the filled amber gradient to a hairline-tinted strip so the
        // notice stays subordinate to the report content (issue 2), and the
        // action is now a real bordered button rather than a ghost link that
        // read as muted text (issue 3).
        <RecoverableState
          state="partial"
          density="compact"
          className="ui-status-panel-quiet rounded-xl"
          title={REPORTS_PARTIAL_DATA_TITLE}
          reason={REPORTS_PARTIAL_DATA_REASON}
          accessibleName="Reports partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link
              href="/settings/health"
              className="ui-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            >
              Review workspace health
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </Link>
          }
        />
      ) : null}

      <section className="ui-card p-0" aria-labelledby="reports-surface-title">
        {/* Card-level bar: the surface label plus a real card-level action —
            a bordered secondary button, not the earlier ghost link (issue 6). */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">Core exports</p>
          <Link
            href="/contracts"
            className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            All contracts
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {/* Master-detail: a grouped report rail beside the active report's
            header, filters, and preview. Replaces the single-row tab strip that
            overflowed and clipped labels (issues 1 / 7 / 9) and breaks the one
            large raised block into a scannable two-pane layout (issue 18). */}
        <div className="flex flex-col lg:flex-row">
          <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-3 py-4 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
            <ReportRail ariaLabel="Reports" items={model.reports} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
              <h2
                id="reports-surface-title"
                className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]"
              >
                {model.activeDefinition.label}
              </h2>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
                {model.activeDefinition.description}
              </p>
            </div>

            <ReportsFilters model={model} />

            <ReportPreviewTable
              model={model}
              emptyStateLabel={REPORTS_EMPTY_STATE}
              previewLabel={REPORT_CONTENT_LABELS.previewTable}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportsFilters({ model }: { model: ReportsPageModel }) {
  const clearHref = buildReportsHref({ report: model.activeReport });
  const hasFilters = hasActiveFilters(model.filters);

  // Compact single-row toolbar. The label now lives inside each control as a
  // caps prefix (§7.3 "WINDOW 90 days" pill) rather than a stacked caps line
  // above it, so the labels stop overpowering the controls (issue 10) and the
  // rounded-pill triggers read as custom comboboxes, not native <select> boxes
  // (issue 11).
  return (
    <form
      action="/reports"
      className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3"
      aria-label={REPORT_CONTENT_LABELS.filters}
    >
      <input type="hidden" name="report" value={model.activeReport} />
      <FilterSelect
        label={REPORT_FILTER_LABELS.window}
        name="window"
        value={model.filters.window}
        options={model.filterOptions.windows}
        width="w-[9.5rem]"
      />
      <FilterSelect
        label={REPORT_FILTER_LABELS.owner}
        name="owner"
        value={model.filters.owner}
        options={model.filterOptions.owners}
        width="w-[12rem]"
      />
      <FilterSelect
        label={REPORT_FILTER_LABELS.counterparty}
        name="counterparty"
        value={model.filters.counterparty}
        options={model.filterOptions.counterparties}
        width="w-[14rem]"
      />
      <FilterSelect
        label={REPORT_FILTER_LABELS.status}
        name="status"
        value={model.filters.status}
        options={model.filterOptions.statuses}
        width="w-[11.5rem]"
      />
      <div className="flex items-center gap-2">
        <button type="submit" className="ui-btn-secondary px-4 py-1.5 text-[12.5px]">
          Apply
        </button>
        {hasFilters ? (
          <Link href={clearHref} className="ui-btn-ghost rounded-full px-3 py-1.5 text-[12px]">
            Clear
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
  width,
}: {
  label: string;
  name: string;
  value: string;
  options: ReportsPageModel["filterOptions"]["windows"];
  width: string;
}) {
  return (
    <UiSelect
      variant="pill"
      label={label}
      className={`block ${width}`}
      buttonClassName="w-full"
      name={name}
      defaultValue={value}
      options={options}
      ariaLabel={label}
    />
  );
}

function hasActiveFilters(filters: ReportFilterState) {
  return filters.window !== "90" || Boolean(filters.owner || filters.counterparty || filters.status);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
