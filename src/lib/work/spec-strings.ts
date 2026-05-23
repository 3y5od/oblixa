export const WORK_EYEBROW = "Contract work";
export const WORK_PAGE_TITLE = "Work";
export const WORK_PRIMARY_CTA = "Create work item";
export const WORK_EMPTY_STATE = "Create work from a contract date, obligation, approval, or exception.";
export const WORK_PARTIAL_DATA_TITLE = "Work data is partially unavailable";
export const WORK_PARTIAL_DATA_REASON =
  "Some work data returned partial results. Visible rows remain available while freshness is restored.";

export const WORK_TAB_LABELS = {
  all: "All",
  my_work: "My work",
  overdue: "Overdue",
  blocked: "Blocked",
  approvals: "Approvals",
  obligations: "Obligations",
  exceptions: "Exceptions",
} as const;

export const WORK_FILTER_LABELS = {
  owner: "Owner",
  dueDate: "Due date",
  contract: "Contract",
  status: "Status",
  type: "Type",
} as const;

export const WORK_ROW_LABELS = {
  title: "Title",
  // v23: "Linked contract" → "Contract". Per the principle that a label
  // shouldn't carry a redundant qualifier — a contract referenced from
  // a work row is by definition linked. "Due date" → "Due" and
  // "Last update" → "Updated" for the same reason: the value beneath
  // each label already supplies the noun ("May 19, 2026" is a date;
  // "2 days ago" reports a recency).
  linkedContract: "Contract",
  owner: "Owner",
  dueDate: "Due",
  status: "Status",
  type: "Type",
  blocker: "Blocker",
  lastUpdate: "Updated",
} as const;

export const WORK_ACTION_LABELS = {
  complete: "Complete",
  reassign: "Reassign",
  change_due_date: "Change due date",
  comment: "Comment",
  link_evidence: "Link evidence",
  escalate: "Escalate",
} as const;

export const WORK_TYPE_LABELS = {
  contract_task: "Task",
  obligation: "Obligation",
  approval: "Approval",
  exception: "Exception",
  evidence_request: "Evidence request",
  renewal_checkpoint: "Renewal checkpoint",
  unassigned_work: "Unassigned work",
} as const;

export const WORK_STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  waiting: "Waiting",
  done: "Done",
  canceled: "Canceled",
} as const;
