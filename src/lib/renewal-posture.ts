import type { V10RenewalPosture } from "./release-contract";

export type V10RenewalHorizon =
  | "365_days"
  | "180_days"
  | "90_days"
  | "60_days"
  | "30_days"
  | "14_days"
  | "7_days"
  | "1_day"
  | "overdue"
  | "none";

export type V10RenewalPostureInput = {
  approvedEndDate?: string | null;
  approvedRenewalDate?: string | null;
  approvedNoticeDeadline?: string | null;
  currentPosture?: V10RenewalPosture | "notice_sent" | "renewed" | "terminated" | null;
  now?: Date;
};

export type V10RenewalCriticalDateDiagnostic =
  | "missing_approved_dates"
  | "notice_overdue"
  | "renewal_overdue"
  | "checkpoint_work_ready"
  | "reminder_ready"
  | "monitor_only";

export type V10RenewalReminderSloEvidence = {
  measurement_key: "renewal_reminders";
  included: boolean;
  reminder_eligible: boolean;
  diagnostic_id: V10RenewalCriticalDateDiagnostic;
  objective_window: "pre_ga_release_candidate" | "post_ga_7_day" | "post_ga_30_day";
  next_action: "create_checkpoint_work" | "send_owner_reminder" | "collect_approved_dates" | "monitor";
};

function daysUntil(raw: string | null | undefined, now: Date): number | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

export function getV10RenewalHorizon(input: V10RenewalPostureInput): V10RenewalHorizon {
  const now = input.now ?? new Date();
  const noticeDays = daysUntil(input.approvedNoticeDeadline, now);
  const renewalDays = daysUntil(input.approvedRenewalDate ?? input.approvedEndDate, now);
  const days = noticeDays ?? renewalDays;
  if (days == null) return "none";
  if (days < 0) return "overdue";
  if (days <= 1) return "1_day";
  if (days <= 7) return "7_days";
  if (days <= 14) return "14_days";
  if (days <= 30) return "30_days";
  if (days <= 60) return "60_days";
  if (days <= 90) return "90_days";
  if (days <= 180) return "180_days";
  if (days <= 365) return "365_days";
  return "none";
}

export function getV10ReminderEligibility(input: V10RenewalPostureInput): {
  reminderEligible: boolean;
  blockedReason: string | null;
} {
  if (!input.approvedRenewalDate && !input.approvedNoticeDeadline && !input.approvedEndDate) {
    return { reminderEligible: false, blockedReason: "missing_approved_dates" };
  }
  return { reminderEligible: true, blockedReason: null };
}

export function deriveV10RenewalPosture(input: V10RenewalPostureInput): V10RenewalPosture {
  const terminal = new Set(["completed", "notice_sent", "renewed", "terminated"]);
  if (input.currentPosture && terminal.has(input.currentPosture)) return "completed";
  const eligibility = getV10ReminderEligibility(input);
  if (!eligibility.reminderEligible) return "blocked_missing_approved_dates";
  const horizon = getV10RenewalHorizon(input);
  if (horizon === "none") return "no_renewal_action_required";
  if (horizon === "overdue") {
    const noticeOverdue = daysUntil(input.approvedNoticeDeadline, input.now ?? new Date());
    return noticeOverdue != null && noticeOverdue < 0 ? "notice_overdue" : "renewal_overdue";
  }
  if (horizon === "1_day" || horizon === "7_days" || horizon === "14_days" || horizon === "30_days") {
    return input.approvedNoticeDeadline ? "notice_deadline_approaching" : "negotiate";
  }
  if (horizon === "60_days" || horizon === "90_days") return "plan";
  return "monitor";
}

export function getV10RenewalCriticalDateDiagnostic(
  input: V10RenewalPostureInput & {
    nextCheckpointWorkItemId?: string | null;
    reminderEligible?: boolean;
  }
): V10RenewalCriticalDateDiagnostic {
  const eligibility = getV10ReminderEligibility(input);
  if (!eligibility.reminderEligible) return "missing_approved_dates";
  const posture = deriveV10RenewalPosture(input);
  if (posture === "notice_overdue") return "notice_overdue";
  if (posture === "renewal_overdue") return "renewal_overdue";
  if (input.nextCheckpointWorkItemId) return "checkpoint_work_ready";
  if (input.reminderEligible ?? eligibility.reminderEligible) return "reminder_ready";
  return "monitor_only";
}

export function buildV10RenewalReminderSloEvidence(
  input: V10RenewalPostureInput & {
    nextCheckpointWorkItemId?: string | null;
    reminderEligible?: boolean;
    objectiveWindow?: V10RenewalReminderSloEvidence["objective_window"];
  }
): V10RenewalReminderSloEvidence {
  const eligibility = getV10ReminderEligibility(input);
  const diagnostic = getV10RenewalCriticalDateDiagnostic(input);
  return {
    measurement_key: "renewal_reminders",
    included: eligibility.reminderEligible,
    reminder_eligible: input.reminderEligible ?? eligibility.reminderEligible,
    diagnostic_id: diagnostic,
    objective_window: input.objectiveWindow ?? "pre_ga_release_candidate",
    next_action:
      diagnostic === "missing_approved_dates"
        ? "collect_approved_dates"
        : diagnostic === "checkpoint_work_ready"
          ? "create_checkpoint_work"
          : diagnostic === "reminder_ready"
            ? "send_owner_reminder"
            : "monitor",
  };
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10RenewalReminderSloEvidence as buildRenewalReminderSloEvidence };
export { deriveV10RenewalPosture as deriveRenewalPosture };
export { getV10ReminderEligibility as getReminderEligibility };
export { getV10RenewalCriticalDateDiagnostic as getRenewalCriticalDateDiagnostic };
export { getV10RenewalHorizon as getRenewalHorizon };
export type { V10RenewalCriticalDateDiagnostic as RenewalCriticalDateDiagnostic };
export type { V10RenewalHorizon as RenewalHorizon };
export type { V10RenewalPostureInput as RenewalPostureInput };
export type { V10RenewalReminderSloEvidence as RenewalReminderSloEvidence };
// End version-name compatibility aliases.
