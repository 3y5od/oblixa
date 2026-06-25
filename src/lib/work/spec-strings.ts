export const WORK_EYEBROW = "Contract follow-up";
export const WORK_PAGE_TITLE = "Tasks";
export const WORK_LEAD =
  "Tasks are follow-up actions from signed contracts: approvals, evidence requests, contract requirements, and problems to resolve.";
export const WORK_PRIMARY_CTA = "Create task";
export const WORK_EMPTY_STATE = "Create a task for a contract date, requirement, approval, problem, or evidence request.";
export const WORK_PARTIAL_DATA_TITLE = "Task data is partially unavailable";
export const WORK_PARTIAL_DATA_REASON =
  "Task counts may be incomplete while imports or contract detail review are still processing. Visible rows remain available while freshness is restored.";

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
// WORK_ACTION_LABELS (the fixed overflow-menu vocabulary). Each label names the
// object it acts on so the action target is unmistakable on its own (§18.6) —
// not a bare "Review"/"Approve"/"Resolve" that leans on the column header.
export const WORK_PRIMARY_ACTION_LABELS = {
  complete: "Mark complete",
  resolve: "Resolve problem",
  review: "Review details",
  approve: "Review approval request",
  attach: "Upload evidence",
  assign: "Assign owner",
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
  // "Open" rather than "Open task": the work feed mixes task types (approval,
  // requirement, problem, evidence), so a status that asserts "task" reads as a
  // contradiction next to a non-task type label. Status is type-agnostic; the
  // type is carried by its own label.
  open: "Open",
  in_progress: "In progress",
  blocked: "Cannot proceed",
  waiting: "Cannot proceed",
  done: "Done",
  canceled: "Canceled",
} as const;
