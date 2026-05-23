import type { REPORT_LABELS, REPORT_WINDOW_LABELS } from "./spec-strings";

export type ReportKey = keyof typeof REPORT_LABELS;
export type ReportWindowKey = keyof typeof REPORT_WINDOW_LABELS;

export type ReportFilterState = {
  window: ReportWindowKey;
  owner: string;
  counterparty: string;
  status: string;
};

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

export type ReportsPageModel = {
  title: string;
  eyebrow: string;
  lead: string;
  primaryCta: string;
  activeReport: ReportKey;
  activeDefinition: ReportDefinition;
  filters: ReportFilterState;
  reports: ReportNavigationItem[];
  previewColumns: readonly string[];
  previewRows: ReportPreviewRow[];
  totalPreviewRows: number;
  exportHref: string;
  lastGeneratedAt: string | null;
  lastGeneratedLabel: string;
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
