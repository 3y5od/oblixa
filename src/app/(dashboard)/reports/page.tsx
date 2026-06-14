import Link from "next/link";
import { AlertTriangle, BarChart3, Download, X } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { CountChip } from "@/components/ui/count-chip";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { RatioChip } from "@/components/ui/ratio-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { ReportRail } from "@/components/reports/report-rail";
import { ReportPreviewTable } from "@/components/reports/report-preview-table";
import { ReportExportHistory } from "@/components/reports/report-export-history";
import { ReportsFilterBar } from "@/components/reports/reports-filter-bar";
import { ReportsRefreshButton } from "@/components/reports/reports-refresh-button";
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
  REPORTS_PARTIAL_DATA_TITLE,
} from "@/lib/reports/spec-strings";
import type { ReportsPageModel } from "@/lib/reports/types";

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

  const isPartial = model.warnings.length > 0;

  const windowLabel = REPORT_WINDOW_LABELS[model.filters.window];
  const exportScopeWindow = REPORT_WINDOWED.has(model.activeReport) ? windowLabel : undefined;
  const hasExportableRows = model.totalPreviewRows > 0;
  const exportTitle = `Export ${model.activeDefinition.label}${
    exportScopeWindow ? ` · ${windowLabel} window` : ""
  }${isPartial ? " · data may be partial" : ""}`;

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<BarChart3 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        density="compact"
        eyebrow={model.eyebrow}
        title={REPORTS_PAGE_TITLE}
        lead={model.lead}
        actions={
          hasExportableRows ? (
            <Link
              href={model.exportHref}
              prefetch={false}
              title={exportTitle}
              aria-label={`${model.exportCtaLabel}${
                exportScopeWindow ? ` for the ${windowLabel} window` : ""
              }${isPartial ? " (data may be partial)" : ""}`}
              className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2"
            >
              <Download className="h-4 w-4" aria-hidden />
              {model.exportCtaLabel}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              title={`No rows to export for ${model.activeDefinition.label} yet.`}
              className="ui-btn-primary pointer-events-none inline-flex items-center gap-2 px-4 py-2 opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {model.exportCtaLabel}
            </span>
          )
        }
      />

      <section className="ui-card p-0" aria-labelledby="reports-surface-title">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border-subtle)] px-5 py-3">
          <p className="ui-caps-2 text-[11px] text-[var(--text-tertiary)]">Report catalog</p>
          <CountChip value={model.reports.length} emphasis="subtle" />
          <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
            Catalog counts are matching rows available in each report.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-3 py-4 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
            <ReportRail ariaLabel="Reports" items={model.reports} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="min-w-0">
                <h2
                  id="reports-surface-title"
                  className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]"
                >
                  {model.activeDefinition.label}
                </h2>
                <p className="mt-1 max-w-2xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
                  {model.activeDefinition.description}
                </p>
                <p className="mt-1.5 max-w-2xl text-[11px] leading-snug text-[var(--text-tertiary)]">
                  <span className="font-medium text-[var(--text-secondary)]">Window:</span> selected reporting period.{" "}
                  <span className="font-medium text-[var(--text-secondary)]">Rows:</span> previewed rows over matching rows.{" "}
                  <span className="font-medium text-[var(--text-secondary)]">Last export:</span> most recent export for this report.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {exportScopeWindow ? <KeyValueChip label="Window" value={windowLabel} /> : null}
                {hasExportableRows ? (
                  model.totalPreviewRows > model.previewRows.length ? (
                    <span
                      title={`Showing ${model.previewRows.length} of ${model.totalPreviewRows} matching rows — export for the full set`}
                    >
                      <RatioChip
                        numerator={model.previewRows.length}
                        denominator={model.totalPreviewRows}
                        suffix="rows"
                      />
                    </span>
                  ) : (
                    <KeyValueChip label="Rows" value={model.totalPreviewRows} />
                  )
                ) : null}
                {model.lastGeneratedAt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1">
                    <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Last export</span>
                    <TimeChip
                      date={model.lastGeneratedAt}
                      format="relative"
                      className="text-[var(--text-secondary)]"
                    />
                  </span>
                ) : (
                  <StatusBadge status="empty">Not exported yet</StatusBadge>
                )}
              </div>
            </div>

            {isPartial ? (
              <ReportsPartialNotice scopeLabel={model.activeDefinition.label} />
            ) : null}

            <ReportsFilters model={model} />

            <ReportPreviewTable
              model={model}
              emptyStateLabel={REPORTS_EMPTY_STATE}
              previewLabel={REPORT_CONTENT_LABELS.previewTable}
            />

            <ReportExportHistory runs={model.recentExports} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportsPartialNotice({ scopeLabel }: { scopeLabel: string }) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Reports partial data state"
      data-state="partial"
      data-v10-state="partial"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-2.5"
      style={{
        borderBottomColor: "color-mix(in oklab, var(--warning-soft) 50%, var(--border-subtle))",
        background: "color-mix(in oklab, var(--warning-soft) 16%, var(--surface-raised))",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "color-mix(in oklab, var(--warning) 26%, var(--border-subtle))",
          background: "color-mix(in oklab, var(--warning-soft) 40%, var(--surface-raised))",
          color: "var(--warning-ink)",
        }}
      >
        <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--text-primary)]">{REPORTS_PARTIAL_DATA_TITLE}.</span>{" "}
        {scopeLabel} preview may be incomplete until data freshness is restored.
      </p>
      <div className="shrink-0">
        <ReportsRefreshButton />
      </div>
    </section>
  );
}

function ReportsFilters({ model }: { model: ReportsPageModel }) {
  return (
    <div className="border-b border-[var(--border-subtle)] px-5 py-3">
      <ReportsFilterBar
        activeReport={model.activeReport}
        filters={model.filters}
        filterOptions={model.filterOptions}
        applicableFilters={model.applicableFilters}
        resetHref={buildReportsHref({ report: model.activeReport })}
        labels={REPORT_FILTER_LABELS}
        ariaLabel={REPORT_CONTENT_LABELS.filters}
      />
      <ReportActiveFilters model={model} />
    </div>
  );
}

function ReportActiveFilters({ model }: { model: ReportsPageModel }) {
  const chips = buildActiveFilterChips(model);
  if (chips.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Active filters</span>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.removeHref}
          aria-label={`Remove ${chip.label.toLowerCase()} filter: ${chip.value}`}
          className="ui-chip-focus inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-0.5 pl-2.5 pr-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <span className="ui-caps-3 text-[9.5px] text-[var(--text-tertiary)]">{chip.label}</span>
          <span className="max-w-[11rem] truncate font-medium text-[var(--text-primary)]">
            {chip.value}
          </span>
          <X className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
        </Link>
      ))}
    </div>
  );
}

type ActiveFilterChip = { key: string; label: string; value: string; removeHref: string };

function buildActiveFilterChips(model: ReportsPageModel): ActiveFilterChip[] {
  const filters = model.filters;
  const applicable = new Set(model.applicableFilters);
  const chips: ActiveFilterChip[] = [];
  if (applicable.has("window") && filters.window !== "90") {
    chips.push({
      key: "window",
      label: REPORT_FILTER_LABELS.window,
      value: REPORT_WINDOW_LABELS[filters.window],
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, window: "90" } }),
    });
  }
  if (applicable.has("owner") && filters.owner) {
    chips.push({
      key: "owner",
      label: REPORT_FILTER_LABELS.owner,
      value: model.filterOptions.owners.find((option) => option.value === filters.owner)?.label ?? filters.owner,
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, owner: "" } }),
    });
  }
  if (applicable.has("counterparty") && filters.counterparty) {
    chips.push({
      key: "counterparty",
      label: REPORT_FILTER_LABELS.counterparty,
      value: filters.counterparty,
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, counterparty: "" } }),
    });
  }
  if (applicable.has("status") && filters.status) {
    chips.push({
      key: "status",
      label: REPORT_FILTER_LABELS.status,
      value: model.filterOptions.statuses.find((option) => option.value === filters.status)?.label ?? filters.status,
      removeHref: buildReportsHref({ report: model.activeReport, filters: { ...filters, status: "" } }),
    });
  }
  return chips;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
