export const EVIDENCE_EYEBROW = "Evidence";
export const EVIDENCE_PAGE_TITLE = "Evidence";
export const EVIDENCE_PAGE_LEAD = "Request, receive, and review proof tied to contract requirements and follow-up tasks.";
export const EVIDENCE_PRIMARY_CTA = "Request evidence";
export const EVIDENCE_EMPTY_STATE = "Request evidence when a contract requirement or follow-up task needs proof.";
export const EVIDENCE_PARTIAL_DATA_TITLE = "Evidence data is partially unavailable";
export const EVIDENCE_PARTIAL_DATA_REASON =
  "Some evidence data returned partial results. Visible requests remain available while freshness is restored.";

export const EVIDENCE_SECTION_LABELS = {
  open_requests: "Open",
  overdue_requests: "Overdue",
  received_evidence: "Received",
  linked_obligations: "Linked requirements",
} as const;

export const EVIDENCE_FILTER_LABELS = {
  owner: "Owner",
  status: "Status",
  dueDate: "Due",
  contract: "Contract",
  obligation: "Requirement",
  fileState: "Files",
} as const;

// Human labels for the due-state filter values — reused by the due dropdown,
// the "Due soon" quick filter, and the active-filter chips.
export const EVIDENCE_DUE_FILTER_LABELS = {
  overdue: "Overdue",
  due_today: "Due today",
  due_soon: "Due soon",
  no_due: "No due date",
} as const;

// Human labels for the file-state filter values — reused by the file dropdown,
// the "Missing file" quick filter, and the active-filter chips.
export const EVIDENCE_FILE_FILTER_LABELS = {
  has_file: "Has file",
  missing_file: "Missing file",
} as const;

export const EVIDENCE_ROW_LABELS = {
  requestTitle: "Request",
  linkedContract: "Linked contract",
  linkedObligation: "Requirement",
  requestOwner: "Owner",
  dueDate: "Due",
  status: "Status",
  attachedFiles: "Files",
} as const;

export const EVIDENCE_STATUS_LABELS = {
  requested: "Requested",
  received: "Received",
  overdue: "Overdue",
  accepted: "Accepted",
  rejected: "Rejected",
} as const;

export const EVIDENCE_ACTION_LABELS = {
  request_evidence: "Request evidence",
  upload_evidence: "Upload evidence",
  accept: "Accept",
  reject: "Reject",
  send_reminder: "Send reminder",
} as const;
