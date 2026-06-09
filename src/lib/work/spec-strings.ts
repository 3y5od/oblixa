export const WORK_EYEBROW = "Contract follow-up";
export const WORK_PAGE_TITLE = "Tasks";
export const WORK_LEAD =
  "Tasks are follow-up actions from signed contracts: approvals, evidence requests, contract requirements, and problems to resolve.";
export const WORK_PRIMARY_CTA = "Create task";
export const WORK_EMPTY_STATE = "Create a task for a contract date, requirement, approval, problem, or evidence request.";
export const WORK_PARTIAL_DATA_TITLE = "Task data is partially unavailable";
export const WORK_PARTIAL_DATA_REASON =
  "Some task data returned partial results. Visible rows remain available while freshness is restored.";

export const WORK_TAB_LABELS = {
  all: "All active",
  my_work: "Assigned to me",
  overdue: "Past due",
  blocked: "Cannot proceed",
  approvals: "Approvals",
  obligations: "Contract requirements",
  exceptions: "Problems to resolve",
} as const;

export const WORK_FILTER_LABELS = {
  owner: "Owner",
  dueDate: "Due",
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
  blocker: "Cannot proceed",
  lastUpdate: "Updated",
} as const;

export const WORK_ACTION_LABELS = {
  complete: "Complete",
  reassign: "Reassign",
  change_due_date: "Change due date",
  comment: "Comment",
  link_evidence: "Link evidence",
} as const;

// Status/type-aware verb for the single primary row action. Distinct from
// WORK_ACTION_LABELS (the fixed overflow-menu vocabulary) so the primary
// control can read "Approve"/"Resolve"/"Attach" without disturbing the
// pinned menu action set.
export const WORK_PRIMARY_ACTION_LABELS = {
  complete: "Complete",
  resolve: "Resolve",
  review: "Review",
  approve: "Approve",
  attach: "Attach",
  assign: "Assign",
} as const;

export const WORK_TYPE_LABELS = {
  contract_task: "Task",
  obligation: "Contract requirement",
  approval: "Approval",
  exception: "Problem",
  evidence_request: "Evidence request",
  renewal_checkpoint: "Renewal task",
  unassigned_work: "Unassigned task",
} as const;

export const WORK_STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Cannot proceed",
  waiting: "Cannot proceed",
  done: "Done",
  canceled: "Canceled",
} as const;
