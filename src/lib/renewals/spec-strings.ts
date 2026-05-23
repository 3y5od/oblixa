export const RENEWALS_EYEBROW = "Renewals";
export const RENEWALS_PAGE_TITLE = "Renewals";
export const RENEWALS_PAGE_LEAD = "Prevent missed renewal and notice dates.";
export const RENEWALS_PRIMARY_CTA = "Create renewal task";
export const RENEWALS_EMPTY_STATE = "Add renewal and notice dates to see upcoming contract decisions.";
export const RENEWALS_PARTIAL_DATA_TITLE = "Renewals data is partially unavailable";
export const RENEWALS_PARTIAL_DATA_REASON =
  "Some renewal data returned partial results. Visible rows remain available while freshness is restored.";

export const RENEWAL_WINDOW_LABELS = {
  "30": "30 days",
  "60": "60 days",
  "90": "90 days",
  "180": "180 days",
} as const;

export const RENEWAL_FILTER_LABELS = {
  owner: "Owner",
  counterparty: "Counterparty",
  status: "Status",
} as const;

export const RENEWAL_ROW_LABELS = {
  contract: "Contract",
  counterparty: "Counterparty",
  renewalDate: "Renewal date",
  noticeDate: "Notice date",
  owner: "Owner",
  status: "Status",
  nextAction: "Next action",
} as const;

export const RENEWAL_STATUS_LABELS = {
  needs_owner: "Needs owner",
  needs_review: "Needs review",
  notice_window_open: "Notice window open",
  in_progress: "In progress",
  completed: "Completed",
  no_renewal_action_needed: "No renewal action needed",
} as const;

export const RENEWAL_ACTION_LABELS = {
  mark_reviewed: "Mark reviewed",
  create_renewal_task: "Create renewal task",
  complete: "Complete",
  reopen: "Reopen",
  export_renewal_report: "Export renewal report",
} as const;
