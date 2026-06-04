import type { REPORT_LABELS, REPORT_WINDOW_LABELS } from "./spec-strings";

export type ReportKey = keyof typeof REPORT_LABELS;
export type ReportWindowKey = keyof typeof REPORT_WINDOW_LABELS;

export type ReportFilterState = {
  window: ReportWindowKey;
  owner: string;
  counterparty: string;
  status: string;
};

/** A filter dimension on the reports surface. Not every report supports every
 *  dimension (e.g. only windowed reports use `window`; the owner-grouped
 *  exceptions report supports only `owner`), so the model declares which apply
 *  per active report and the toolbar renders only those. */
export type ReportFilterKey = "window" | "owner" | "counterparty" | "status";

export type ReportOption = {
  value: string;
  label: string;
};

export type ReportDefinition = {
  key: ReportKey;
  label: string;
  description: string;
  columns: readonly string[];
};

export type ReportPreviewRow = {
  id: string;
  href?: string | null;
  cells: Record<string, string>;
};

export type ReportNavigationItem = {
  key: ReportKey;
  label: string;
  description: string;
  count: number;
  href: string;
  active: boolean;
};

/**
 * One completed export run, derived from `contract_export_jobs`. Surfaced as the
 * "Recent exports" run history so the page exposes report-run status/time/rows
 * and a one-click re-export, per the release-state "report history" ask.
 */
export type ReportExportRun = {
  reportKey: ReportKey;
  reportLabel: string;
  /** Compact scope tokens rebuilt from the run's stored filters, e.g.
   *  ["90 days"] or ["90 days", "Filtered"]. Rendered as a caps meta line with
   *  `.ui-dot-sep` separators (never a bare middle-dot). Empty when defaults. */
  scope: string[];
  /** Normalized job status, e.g. "completed". */
  status: string;
  /** ISO timestamp the run completed (falls back to created_at), or null. */
  at: string | null;
  /** Exact, compact run time ("May 30, 3:42 PM") — distinguishes runs that a
   *  relative time would clump into the same bucket. Empty when `at` is null. */
  atLabel: string;
  /** Rows written in that run, when recorded. */
  rows: number | null;
  /** Export format, e.g. "csv", when recorded. */
  format: string | null;
  /** Re-export link rebuilt from the run's report + filters. */
  href: string;
};

export type ReportsPageModel = {
  title: string;
  eyebrow: string;
  lead: string;
  primaryCta: string;
  activeReport: ReportKey;
  activeDefinition: ReportDefinition;
  filters: ReportFilterState;
  /** Filter dimensions the active report actually supports, in display order.
   *  The toolbar renders a select only for these so a report never offers a
   *  no-op control (e.g. a date window on a non-windowed report). */
  applicableFilters: ReportFilterKey[];
  reports: ReportNavigationItem[];
  previewColumns: readonly string[];
  previewRows: ReportPreviewRow[];
  totalPreviewRows: number;
  exportHref: string;
  /** Context-aware export label, e.g. "Export upcoming renewals". `primaryCta`
   *  stays the generic "Export report" for aria/fallback. */
  exportCtaLabel: string;
  lastGeneratedAt: string | null;
  lastGeneratedLabel: string;
  recentExports: ReportExportRun[];
  filterOptions: {
    windows: ReportOption[];
    owners: ReportOption[];
    counterparties: ReportOption[];
    statuses: ReportOption[];
  };
  warnings: string[];
};

export type ReportsModelSearchInput = {
  report?: string | null;
  family?: string | null;
  window?: string | null;
  owner?: string | null;
  counterparty?: string | null;
  status?: string | null;
};

export type ReportsModelLoadInput = ReportsModelSearchInput & {
  userId: string;
  role?: string | null;
  workspaceMode?: string | null;
  previewLimit?: number | null;
};
