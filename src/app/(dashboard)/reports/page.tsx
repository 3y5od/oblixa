import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Download, FileText, X } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { ReportRail } from "@/components/reports/report-rail";
import { ReportPreviewTable } from "@/components/reports/report-preview-table";
import { ReportExportHistory } from "@/components/reports/report-export-history";
import { ReportsFilterBar } from "@/components/reports/reports-filter-bar";
import { ReportsRefreshButton } from "@/components/reports/reports-refresh-button";
import { REPORT_WINDOWED } from "@/components/reports/report-display";
import { getAuthContext } from "@/lib/supabase/server";
import { isWorkspaceAdminRole } from "@/lib/roles";
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
import type { ReportsPageModel } from "@/lib/reports/types";
import { buildActiveFilterChips } from "./reports-active-filter-chips";

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
  const exportScopeWindow = REPORT_WINDOWED.has(model.activeReport);
  // release-state Action Permission Matrix: report/inventory export is Owner/Admin
  // by default; Member/Viewer are denied unless explicitly entitled.
  const canExport = isWorkspaceAdminRole(ctx.role);
  const hasExportableRows = model.totalPreviewRows > 0;
  const lastExportValue = model.lastGeneratedAt ? model.lastGeneratedLabel : "none";
  const exportAria = `${model.exportCtaLabel}${
    exportScopeWindow ? ` for the ${windowLabel} window` : ""
  }${isPartial ? " (data may be partial)" : ""}`;

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<FileText className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.7} />}
        density="compact"
        eyebrow={model.eyebrow}
        title={REPORTS_PAGE_TITLE}
        lead={model.lead}
      />

      <section
        className="overflow-hidden rounded-[5px] border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
        aria-labelledby="reports-surface-title"
      >
        {/* Catalog header strip — names the index and states how many reports it
            holds. (Each rail entry carries its own blurb; no separate help line.) */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,var(--surface-raised))] px-5 py-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]">
            Report catalog
          </p>
          <p className="text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
            {model.reports.length} reports
          </p>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left index — the report catalog as a legal table of contents. */}
          <div className="border-b border-[var(--border-subtle)] px-3 py-4 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
            <ReportRail ariaLabel="Report catalog" items={model.reports} />
          </div>

          {/* Right inspection — the selected report, its scope, limitations,
              filters, preview, and run history. */}
          <div className="min-w-0 flex-1">
            <InspectionHeader
              model={model}
              windowLabel={windowLabel}
              exportScopeWindow={exportScopeWindow}
              canExport={canExport}
              hasExportableRows={hasExportableRows}
              lastExportValue={lastExportValue}
              exportAria={exportAria}
            />

            {isPartial ? <ReportsPartialNotice scopeLabel={model.activeDefinition.label} /> : null}

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

function InspectionHeader({
  model,
  windowLabel,
  exportScopeWindow,
  canExport,
  hasExportableRows,
  lastExportValue,
  exportAria,
}: {
  model: ReportsPageModel;
  windowLabel: string;
  exportScopeWindow: boolean;
  canExport: boolean;
  hasExportableRows: boolean;
  lastExportValue: string;
  exportAria: string;
}) {
  const exportReasonId = "reports-export-disabled-reason";
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-b border-[var(--border-subtle)] px-5 py-4">
      <div className="min-w-0">
        <h2
          id="reports-surface-title"
          className="text-[1.1rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]"
        >
          {model.activeDefinition.label}
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-snug text-[var(--text-secondary)]">
          {model.activeDefinition.description}
        </p>
        <dl className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px]">
          {exportScopeWindow ? <MetaPair label="Window">{windowLabel}</MetaPair> : null}
          <MetaPair label="Rows">
            {hasExportableRows
              ? `${model.previewRows.length} previewed of ${model.totalPreviewRows} matching`
              : `${model.totalPreviewRows} matching`}
          </MetaPair>
          <MetaPair label="Last export">{lastExportValue}</MetaPair>
        </dl>
      </div>

      {/* Report-scoped primary action: it exports the active report, so it lives
          with the report rather than as generic page chrome. */}
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        {!canExport ? (
          // Role-denied: a real disabled button (focusable for AT) + reason.
          <>
            <button
              type="button"
              disabled
              aria-describedby={exportReasonId}
              className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2 opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {model.exportCtaLabel}
            </button>
            <span id={exportReasonId} className="max-w-[16rem] text-[11px] leading-snug text-[var(--text-tertiary)] sm:text-right">
              Exporting reports requires Owner or Admin access in this workspace.
            </span>
          </>
        ) : hasExportableRows ? (
          <Link
            href={model.exportHref}
            prefetch={false}
            aria-label={exportAria}
            className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2"
          >
            <Download className="h-4 w-4" aria-hidden />
            {model.exportCtaLabel}
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-describedby={exportReasonId}
              className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2 opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {model.exportCtaLabel}
            </button>
            <span id={exportReasonId} className="text-[11px] leading-snug text-[var(--text-tertiary)]">
              No rows to export yet.
            </span>
          </>
        )}
        {/* Partial-data disclosure lives once, in the page-level amber banner
            (which also carries the Refresh action) — not duplicated here. */}
      </div>
    </div>
  );
}

function MetaPair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[var(--text-tertiary)]">{label}:</dt>
      <dd className="font-medium tabular-nums text-[var(--text-secondary)]">{children}</dd>
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
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3"
      style={{
        borderBottomColor: "color-mix(in oklab, var(--warning-soft) 50%, var(--border-subtle))",
        background: "color-mix(in oklab, var(--warning-soft) 18%, var(--surface-raised))",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
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
        {REPORTS_PARTIAL_DATA_REASON} The {scopeLabel} preview may be incomplete.
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
          className="ui-chip-focus inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-0.5 pl-2.5 pr-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
