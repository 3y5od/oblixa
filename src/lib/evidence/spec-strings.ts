export const EVIDENCE_EYEBROW = "Evidence";
export const EVIDENCE_PAGE_TITLE = "Evidence";
export const EVIDENCE_PAGE_LEAD = "Track proof that contract work was completed.";
export const EVIDENCE_PRIMARY_CTA = "Request evidence";
export const EVIDENCE_EMPTY_STATE = "Request evidence when a contract obligation needs proof of completion.";
export const EVIDENCE_PARTIAL_DATA_TITLE = "Evidence data is partially unavailable";
export const EVIDENCE_PARTIAL_DATA_REASON =
  "Some evidence data returned partial results. Visible requests remain available while freshness is restored.";

export const EVIDENCE_SECTION_LABELS = {
  open_requests: "Open requests",
  overdue_requests: "Overdue requests",
  received_evidence: "Received evidence",
  linked_obligations: "Evidence linked to obligations",
} as const;

export const EVIDENCE_ROW_LABELS = {
  requestTitle: "Request title",
  linkedContract: "Linked contract",
  linkedObligation: "Linked obligation",
  requestOwner: "Request owner",
  dueDate: "Due date",
  status: "Status",
  attachedFiles: "Attached files",
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
