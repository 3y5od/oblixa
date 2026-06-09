export const REPORTS_EYEBROW = "Reports";
export const REPORTS_PAGE_TITLE = "Reports";
export const REPORTS_PAGE_LEAD = "Export operational reports for renewals, tasks, evidence, issues, and contract inventory.";
export const REPORTS_PRIMARY_CTA = "Export report";
export const REPORTS_EMPTY_STATE = "Reports become more useful as you confirm contract details, assign owners, and track tasks.";

export const REPORTS_PARTIAL_DATA_TITLE = "Report data is partially unavailable";
export const REPORTS_PARTIAL_DATA_REASON =
  "Some previews may be incomplete until data freshness is restored.";

export const REPORT_LABELS = {
  upcoming_renewals: "Upcoming renewals",
  notice_deadlines: "Notice deadlines",
  missing_owners: "Missing owners",
  missing_key_fields: "Missing key details",
  open_obligations: "Open requirements",
  overdue_work: "Overdue tasks",
  exceptions_by_owner: "Issues by owner",
  evidence_requests: "Evidence requests",
  contract_inventory: "Contract inventory",
  review_completeness: "Confirmation completeness",
} as const;

export const REPORT_FILTER_LABELS = {
  // "Window": the two-token pill always shows the caps label beside the value
  // ("WINDOW │ 90 days"), and the windowed reports (upcoming renewals, notice
  // deadlines) already supply the renewal context, so the shorter label is clear.
  window: "Window",
  owner: "Owner",
  counterparty: "Counterparty",
  status: "Status",
} as const;

export const REPORT_WINDOW_LABELS = {
  "30": "30 days",
  "60": "60 days",
  "90": "90 days",
  "180": "180 days",
} as const;

export const REPORT_CONTENT_LABELS = {
  description: "Description",
  filters: "Filters",
  // Displayed above the preview list. "Preview" alone is calmer than the older
  // "Preview table" now that the surface reads as a dense list, not a grid.
  previewTable: "Preview",
  exportButton: "Export button",
  lastGenerated: "Last generated timestamp",
} as const;
