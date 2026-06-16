export const REPORTS_EYEBROW = "Reports";
export const REPORTS_PAGE_TITLE = "Reports";
export const REPORTS_PAGE_LEAD =
  "Preview and export operational reports for renewals, notice deadlines, tasks, evidence, and contract inventory.";
export const REPORTS_PRIMARY_CTA = "Export report";
export const REPORTS_EMPTY_STATE = "Reports become more useful as you confirm contract details, assign owners, and track tasks.";

export const REPORTS_PARTIAL_DATA_TITLE = "Report data is partially available";
export const REPORTS_PARTIAL_DATA_REASON =
  "Rows may be incomplete until report data is refreshed.";

/** Trust disclosure shown beneath date-bearing report previews (renewals, notice
 *  deadlines). States what provenance is included and that softer states are
 *  labeled rather than hidden, so an exported CSV is never mistaken for fully
 *  confirmed data. */
export const REPORTS_DATE_STATE_DISCLOSURE =
  "Confirmed and calculated dates are included. Suggested and missing dates are labeled in each row before export.";

export const REPORT_LABELS = {
  upcoming_renewals: "Upcoming renewals",
  notice_deadlines: "Notice deadlines",
  missing_owners: "Missing owners",
  missing_key_fields: "Missing key details",
  open_obligations: "Open requirements",
  overdue_work: "Overdue tasks",
  exceptions_by_owner: "Problems by owner",
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
  // Displayed above the preview list. "Report preview" names the artifact as an
  // exportable operational record rather than a generic data grid.
  previewTable: "Report preview",
  exportButton: "Export button",
  lastGenerated: "Last generated timestamp",
} as const;
