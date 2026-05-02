import {
  V10_REQUIRED_ACTIVATION_FIELDS,
  type V10FieldState,
} from "./v10-release-contract";

export type V10DataQualityGap =
  | "missing_required_field"
  | "missing_recommended_field"
  | "conflicting_dates"
  | "stale_extracted_value"
  | "duplicate_candidate"
  | "no_owner"
  | "no_counterparty"
  | "reminder_blocking_date_gap"
  | "report_blocking_data_gap";

export type V10ReviewQueueSignalInput = {
  missingCriticalDates?: number;
  pendingRequiredFields?: number;
  valueUsd?: number | null;
  renewalNoticeDeadlineInside30Days?: boolean;
  openBlockers?: number;
};

export type V10FieldReviewNextAction =
  | "approve_high_confidence"
  | "request_clarification"
  | "supply_missing_value"
  | "review_stale_source"
  | "save_and_next"
  | "no_action_required";

export type V10CriticalDateBlocker =
  | "effective_date_missing"
  | "end_date_missing"
  | "end_before_effective"
  | "notice_after_renewal"
  | "renewal_after_end";

export type V10DataQualityRemediationWork = {
  contract_id: string;
  work_type: "data_quality_remediation";
  gaps: readonly V10DataQualityGap[];
  primary_action: string;
  audit_event_id: string | null;
  visible_in_work: boolean;
};

export type V10SaveAndNextOutcome = {
  next_index: number | null;
  completed_current: boolean;
  queue_complete: boolean;
  performance_budget_ok: boolean;
  diagnostic_id: string | null;
};

export function isV10RequiredActivationField(field: string): boolean {
  return (V10_REQUIRED_ACTIVATION_FIELDS as readonly string[]).includes(field);
}

export function rankV10ReviewQueueItem(input: V10ReviewQueueSignalInput): number {
  return (
    (input.missingCriticalDates ?? 0) * 100 +
    (input.pendingRequiredFields ?? 0) * 50 +
    ((input.valueUsd ?? 0) >= 250_000 ? 25 : 0) +
    (input.renewalNoticeDeadlineInside30Days ? 20 : 0) +
    (input.openBlockers ?? 0) * 10
  );
}

export function classifyV10DataQualityGap(input: {
  required?: boolean;
  recommended?: boolean;
  dateConflict?: boolean;
  staleSource?: boolean;
  duplicate?: boolean;
  ownerMissing?: boolean;
  counterpartyMissing?: boolean;
  reminderBlocked?: boolean;
  reportBlocked?: boolean;
}): V10DataQualityGap[] {
  const gaps: V10DataQualityGap[] = [];
  if (input.required) gaps.push("missing_required_field");
  if (input.recommended) gaps.push("missing_recommended_field");
  if (input.dateConflict) gaps.push("conflicting_dates");
  if (input.staleSource) gaps.push("stale_extracted_value");
  if (input.duplicate) gaps.push("duplicate_candidate");
  if (input.ownerMissing) gaps.push("no_owner");
  if (input.counterpartyMissing) gaps.push("no_counterparty");
  if (input.reminderBlocked) gaps.push("reminder_blocking_date_gap");
  if (input.reportBlocked) gaps.push("report_blocking_data_gap");
  return gaps;
}

export function canTransitionV10FieldState(from: V10FieldState, to: V10FieldState): boolean {
  if (from === to) return true;
  if (to === "approved") return from === "extracted" || from === "ambiguous" || from === "user_supplied" || from === "stale_source";
  if (to === "rejected") return from !== "approved";
  if (to === "user_supplied") return true;
  return to === "missing" || to === "ambiguous" || to === "stale_source";
}

export function getV10FieldReviewNextAction(input: {
  state: V10FieldState;
  confidenceState?: "high" | "medium" | "low" | "unknown" | string | null;
  rejectionReason?: string | null;
}): V10FieldReviewNextAction {
  if (input.state === "approved") return "no_action_required";
  if (input.state === "missing") return "supply_missing_value";
  if (input.state === "stale_source") return "review_stale_source";
  if (input.state === "rejected") return input.rejectionReason?.trim() ? "request_clarification" : "save_and_next";
  if (input.state === "ambiguous" || input.confidenceState === "low" || input.confidenceState === "unknown") {
    return "request_clarification";
  }
  if (input.state === "extracted" && input.confidenceState === "high") return "approve_high_confidence";
  return "save_and_next";
}

function parseDateOnly(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getV10CriticalDateBlockers(input: {
  effectiveDate?: string | null;
  endDate?: string | null;
  renewalDate?: string | null;
  noticeDeadline?: string | null;
}): V10CriticalDateBlocker[] {
  const blockers: V10CriticalDateBlocker[] = [];
  const effective = parseDateOnly(input.effectiveDate);
  const end = parseDateOnly(input.endDate);
  const renewal = parseDateOnly(input.renewalDate);
  const notice = parseDateOnly(input.noticeDeadline);

  if (effective == null) blockers.push("effective_date_missing");
  if (end == null) blockers.push("end_date_missing");
  if (effective != null && end != null && end < effective) blockers.push("end_before_effective");
  if (notice != null && renewal != null && notice > renewal) blockers.push("notice_after_renewal");
  if (renewal != null && end != null && renewal > end) blockers.push("renewal_after_end");
  return blockers;
}

export function buildV10DataQualityRemediationWork(input: {
  contractId: string;
  gaps: readonly V10DataQualityGap[];
  auditEventId?: string | null;
}): V10DataQualityRemediationWork | null {
  if (input.gaps.length === 0) return null;
  const priorityGap = input.gaps[0];
  return {
    contract_id: input.contractId,
    work_type: "data_quality_remediation",
    gaps: input.gaps,
    primary_action:
      priorityGap === "duplicate_candidate"
        ? "review_duplicate_candidate"
        : priorityGap === "reminder_blocking_date_gap" || priorityGap === "report_blocking_data_gap"
          ? "supply_approved_critical_dates"
          : "open_field_review",
    audit_event_id: input.auditEventId ?? null,
    visible_in_work: true,
  };
}

export function getV10SaveAndNextOutcome(input: {
  currentIndex: number;
  totalItems: number;
  mutationOutcome: "success" | "no_action" | "validation_failed" | "stale_version" | "server_error";
  elapsedMs: number;
  performanceBudgetMs?: number;
}): V10SaveAndNextOutcome {
  const completedCurrent = input.mutationOutcome === "success" || input.mutationOutcome === "no_action";
  const queueComplete = completedCurrent && input.currentIndex >= input.totalItems - 1;
  const performanceBudgetOk = input.elapsedMs <= (input.performanceBudgetMs ?? 700);
  return {
    next_index: completedCurrent && !queueComplete ? input.currentIndex + 1 : null,
    completed_current: completedCurrent,
    queue_complete: queueComplete,
    performance_budget_ok: performanceBudgetOk,
    diagnostic_id: performanceBudgetOk ? null : "v10_save_and_next_latency_budget_exceeded",
  };
}
