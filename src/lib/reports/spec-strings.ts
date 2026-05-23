export const REPORTS_EYEBROW = "Reports";
export const REPORTS_PAGE_TITLE = "Reports";
export const REPORTS_PAGE_LEAD = "Export operational reports for renewals, work, evidence, exceptions, and contract inventory.";
export const REPORTS_PRIMARY_CTA = "Export report";
export const REPORTS_EMPTY_STATE = "Reports become more useful as you review fields, assign owners, and track work.";

export const REPORTS_PARTIAL_DATA_TITLE = "Reports data is partially unavailable";
export const REPORTS_PARTIAL_DATA_REASON =
  "Some report data returned partial results. Available previews remain usable while data freshness is restored.";

export const REPORT_LABELS = {
  upcoming_renewals: "Upcoming renewals",
  notice_deadlines: "Notice deadlines",
  missing_owners: "Missing owners",
  missing_key_fields: "Missing key fields",
  open_obligations: "Open obligations",
  overdue_work: "Overdue work",
  exceptions_by_owner: "Exceptions by owner",
  evidence_requests: "Evidence requests",
  contract_inventory: "Contract inventory",
  review_completeness: "Review completeness",
} as const;

export const REPORT_FILTER_LABELS = {
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
  previewTable: "Preview table",
  exportButton: "Export button",
  lastGenerated: "Last generated timestamp",
} as const;
