import type {
  V10ActivationState,
  V10FieldState,
  V10JobStatus,
  V10MutationOutcome,
  V10RenewalPosture,
  V10WorkItemStatus,
} from "./v10-release-contract";

export type V10LegacyStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "succeeded"
  | "failed"
  | "partial"
  | "cancelled"
  | "canceled";

export type V10SharedAction =
  | "assign_owner"
  | "complete_work_item"
  | "request_evidence"
  | "review_evidence"
  | "approve"
  | "reject"
  | "retry_job"
  | "run_report"
  | "create_export"
  | "update_settings"
  | "open_source_record";

export const V10_SHARED_ACTION_VOCABULARY: Record<V10SharedAction, { label: string; auditVerb: string }> = {
  assign_owner: { label: "Assign owner", auditVerb: "owner.assigned" },
  complete_work_item: { label: "Complete work item", auditVerb: "work_item.completed" },
  request_evidence: { label: "Request evidence", auditVerb: "evidence.requested" },
  review_evidence: { label: "Review evidence", auditVerb: "evidence.reviewed" },
  approve: { label: "Approve", auditVerb: "approval.approved" },
  reject: { label: "Reject", auditVerb: "approval.rejected" },
  retry_job: { label: "Retry job", auditVerb: "job.retried" },
  run_report: { label: "Run report", auditVerb: "report.run_created" },
  create_export: { label: "Create export", auditVerb: "export.created" },
  update_settings: { label: "Update settings", auditVerb: "settings.updated" },
  open_source_record: { label: "Open source record", auditVerb: "source.opened" },
};

export function adaptLegacyStatusToV10JobStatus(status: V10LegacyStatus, retryable = true): V10JobStatus {
  if (status === "pending" || status === "queued") return "queued";
  if (status === "processing") return "running";
  if (status === "completed" || status === "succeeded") return "succeeded";
  if (status === "partial") return "partial";
  if (status === "cancelled" || status === "canceled") return "canceled";
  return retryable ? "failed_retryable" : "failed_terminal";
}

export function getV10SharedActionAuditVerb(action: V10SharedAction): string {
  return V10_SHARED_ACTION_VOCABULARY[action].auditVerb;
}

export type V10StateMachineName = "job" | "work_item" | "activation" | "field_review" | "renewal" | "mutation";

export type V10StateMachineState =
  | V10JobStatus
  | V10WorkItemStatus
  | V10ActivationState
  | V10FieldState
  | V10RenewalPosture
  | V10MutationOutcome;

export type V10StateTransitionInput = {
  machine: V10StateMachineName;
  from: string;
  to: string;
  occurredAt?: string | Date | null;
  previousOccurredAt?: string | Date | null;
  idempotencyKey?: string | null;
  seenIdempotencyKeys?: ReadonlySet<string>;
};

export type V10OrderedStateEvent = {
  id: string;
  state: string;
  occurredAt: string;
  sequence: number;
  idempotencyKey?: string | null;
};

const V10_STATE_TRANSITIONS: Record<V10StateMachineName, Record<string, readonly string[]>> = {
  job: {
    queued: ["running", "canceled"],
    running: ["succeeded", "partial", "failed_retryable", "failed_terminal", "canceled"],
    failed_retryable: ["retrying", "failed_terminal"],
    retrying: ["running", "failed_terminal", "canceled"],
    partial: ["retrying", "succeeded", "failed_terminal"],
    succeeded: [],
    failed_terminal: [],
    canceled: [],
  },
  work_item: {
    open: ["in_progress", "blocked", "waiting", "done", "canceled"],
    in_progress: ["blocked", "waiting", "done", "canceled"],
    blocked: ["in_progress", "waiting", "canceled"],
    waiting: ["in_progress", "blocked", "canceled"],
    done: [],
    canceled: [],
  },
  activation: {
    workspace_prepared: ["contract_uploaded_or_imported"],
    contract_uploaded_or_imported: ["extraction_queued"],
    extraction_queued: ["extraction_running"],
    extraction_running: ["extraction_partially_complete", "extraction_failed", "required_field_review_ready"],
    extraction_partially_complete: ["required_field_review_ready", "extraction_failed"],
    extraction_failed: ["extraction_queued"],
    required_field_review_ready: ["required_fields_approved"],
    required_fields_approved: ["owner_assigned"],
    owner_assigned: ["first_work_item_generated"],
    first_work_item_generated: ["dashboard_updated"],
    dashboard_updated: [],
  },
  field_review: {
    extracted: ["approved", "rejected", "ambiguous", "stale_source"],
    missing: ["user_supplied", "stale_source"],
    ambiguous: ["approved", "rejected", "user_supplied", "stale_source"],
    user_supplied: ["approved", "rejected", "stale_source"],
    rejected: ["user_supplied", "stale_source"],
    approved: ["stale_source"],
    stale_source: ["extracted", "missing", "user_supplied"],
  },
  renewal: {
    no_approved_renewal_data: ["blocked_missing_approved_dates", "no_renewal_action_required", "monitor"],
    blocked_missing_approved_dates: ["monitor", "plan"],
    no_renewal_action_required: ["monitor"],
    monitor: ["plan", "notice_deadline_approaching", "renewal_overdue", "completed"],
    plan: ["negotiate", "notice_deadline_approaching", "completed"],
    negotiate: ["notice_deadline_approaching", "notice_overdue", "completed"],
    notice_deadline_approaching: ["notice_overdue", "completed"],
    notice_overdue: ["renewal_overdue", "completed"],
    renewal_overdue: ["completed"],
    completed: [],
  },
  mutation: {
    validation_failed: [],
    unauthorized: [],
    forbidden: [],
    not_found: [],
    conflict: [],
    stale_version: [],
    plan_required: [],
    mode_required: [],
    hidden_module: [],
    rate_limited: [],
    dependency_blocked: [],
    job_not_retryable: [],
    external_link_expired: [],
    external_link_revoked: [],
    audit_write_failed: [],
    no_action: [],
    server_error: [],
    success: [],
  },
};

export function getAllowedV10NextStates(machine: V10StateMachineName, from: string): readonly string[] {
  return V10_STATE_TRANSITIONS[machine][from] ?? [];
}

export function validateV10StateTransition(input: V10StateTransitionInput): string[] {
  const failures: string[] = [];
  const allowed = getAllowedV10NextStates(input.machine, input.from);
  if (input.from === input.to) failures.push("duplicate_transition");
  if (!Object.prototype.hasOwnProperty.call(V10_STATE_TRANSITIONS[input.machine], input.from)) {
    failures.push("unknown_from_state");
  } else if (!allowed.includes(input.to)) {
    failures.push("transition_not_allowed");
  }
  if (input.previousOccurredAt && input.occurredAt) {
    const previous = new Date(input.previousOccurredAt).getTime();
    const current = new Date(input.occurredAt).getTime();
    if (Number.isFinite(previous) && Number.isFinite(current) && current < previous) failures.push("transition_out_of_order");
  }
  if (input.idempotencyKey && input.seenIdempotencyKeys?.has(input.idempotencyKey)) {
    failures.push("duplicate_idempotency_key");
  }
  return failures;
}

export function dedupeAndOrderV10StateEvents(events: readonly V10OrderedStateEvent[]): V10OrderedStateEvent[] {
  const seen = new Set<string>();
  return [...events]
    .sort((left, right) => {
      const byTime = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
      return byTime === 0 ? left.sequence - right.sequence : byTime;
    })
    .filter((event) => {
      const key = event.idempotencyKey ?? `${event.id}:${event.state}:${event.occurredAt}:${event.sequence}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
