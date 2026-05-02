import type { V10NotificationClass } from "./v10-release-contract";
import { V10_NOTIFICATION_CLASSES } from "./v10-release-contract";

export type V10ExternalLinkState = "active" | "expired" | "revoked" | "invalid";
export type V10ResponderIdentityState = "provided" | "not_provided" | "redacted";
export type V10EvidenceReviewState = "open" | "submitted" | "accepted" | "rejected" | "overdue" | "expired";
export type V10NotificationDeliveryState =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "suppressed"
  | "failed_retryable"
  | "failed_terminal"
  | "skipped_quiet_hours";
export type V10NotificationRecipientState =
  | "workspace_member"
  | "external_responder"
  | "automation_approver"
  | "suppressed"
  | "redacted";
export type V10EvidenceAccountabilityState =
  | "no_request"
  | "awaiting_external"
  | "ready_for_review"
  | "rejected_resubmission_allowed"
  | "blocked_link_expired"
  | "blocked_link_revoked"
  | "overdue_follow_up"
  | "accepted";

export type V10NotificationDeliveryContract = {
  notificationClass: V10NotificationClass;
  sourceObjectType: string;
  sourceObjectId: string;
  recipientState: V10NotificationRecipientState;
  deliveryState: V10NotificationDeliveryState;
  provider: "resend" | "internal" | "webhook" | "none";
  providerMessageId: string | null;
  dedupeKey: string;
  workspaceTimezone: string;
  quietHoursApplied: boolean;
  retryAt: string | null;
  auditAction: string;
  diagnosticId: string | null;
  supportSafeMetadata: Record<string, string | number | boolean | null>;
};

export type V10ExternalResponderPublicState = {
  link_state: V10ExternalLinkState;
  responder_identity_state: V10ResponderIdentityState;
  accountability_state: V10EvidenceAccountabilityState;
  can_submit: boolean;
  can_resubmit: boolean;
  user_visible_message: string;
  diagnostic_id: string | null;
};

export function getV10ExternalLinkState(input: {
  tokenValid: boolean;
  expiresAt?: string | null;
  revokedAt?: string | null;
  now?: Date;
}): V10ExternalLinkState {
  if (!input.tokenValid) return "invalid";
  if (input.revokedAt) return "revoked";
  if (input.expiresAt && new Date(input.expiresAt) < (input.now ?? new Date())) return "expired";
  return "active";
}

export function validateV10ExternalEvidenceSubmission(input: {
  linkState: V10ExternalLinkState;
  requiredNote: boolean;
  note?: string | null;
  fileTypes: string[];
  allowedFileTypes: string[];
}): string[] {
  const failures: string[] = [];
  if (input.linkState === "expired") failures.push("external_link_expired");
  if (input.linkState === "revoked") failures.push("external_link_revoked");
  if (input.linkState === "invalid") failures.push("external_link_invalid");
  if (input.requiredNote && !input.note?.trim()) failures.push("required_note_missing");
  const allowed = new Set(input.allowedFileTypes.map((value) => value.toLowerCase()));
  for (const type of input.fileTypes) {
    if (!allowed.has(type.toLowerCase())) failures.push("file_type_not_allowed");
  }
  return [...new Set(failures)];
}

export function validateV10NotificationDeliveryContract(input: V10NotificationDeliveryContract): string[] {
  const failures: string[] = [];
  if (!(V10_NOTIFICATION_CLASSES as readonly string[]).includes(input.notificationClass)) {
    failures.push("notification_class_unknown");
  }
  if (!input.sourceObjectType.trim()) failures.push("source_object_type_required");
  if (!input.sourceObjectId.trim()) failures.push("source_object_id_required");
  if (!input.dedupeKey.trim()) failures.push("dedupe_key_required");
  if (!input.workspaceTimezone.trim()) failures.push("workspace_timezone_required");
  if (!input.auditAction.includes(".")) failures.push("audit_action_required");
  if (input.deliveryState === "sent" || input.deliveryState === "delivered") {
    if (input.provider === "none") failures.push("provider_required_for_delivery");
    if (!input.providerMessageId) failures.push("provider_message_id_required");
  }
  if (input.deliveryState === "failed_retryable" && !input.retryAt) failures.push("retry_at_required");
  if (
    ["bounced", "suppressed", "failed_retryable", "failed_terminal", "skipped_quiet_hours"].includes(input.deliveryState) &&
    !input.diagnosticId
  ) {
    failures.push("diagnostic_id_required");
  }
  if (input.deliveryState === "skipped_quiet_hours" && !input.quietHoursApplied) {
    failures.push("quiet_hours_state_required");
  }
  if (input.notificationClass === "automation_approval_required" && input.recipientState !== "automation_approver") {
    failures.push("automation_approval_requires_approver_recipient");
  }
  for (const key of Object.keys(input.supportSafeMetadata)) {
    if (/email|token|raw|text|url|phone|address/i.test(key)) failures.push(`support_metadata_private_key:${key}`);
  }
  return failures;
}

export function getV10EvidenceFollowUpSchedule(dueAt: string, now = new Date()): {
  dueMinus3DaysAt: string;
  dueAt: string;
  overdueStateAt: string;
  ownerNotificationAt: string;
  escalationWorkItemAt: string;
  overdue: boolean;
} {
  const due = new Date(dueAt);
  const dueMinus3 = new Date(due);
  dueMinus3.setDate(due.getDate() - 3);
  const overdue = new Date(due);
  overdue.setMinutes(due.getMinutes() + 5);
  const notify = new Date(due);
  notify.setHours(due.getHours() + 1);
  const escalate = new Date(due);
  escalate.setHours(due.getHours() + 24);
  return {
    dueMinus3DaysAt: dueMinus3.toISOString(),
    dueAt: due.toISOString(),
    overdueStateAt: overdue.toISOString(),
    ownerNotificationAt: notify.toISOString(),
    escalationWorkItemAt: escalate.toISOString(),
    overdue: now > due,
  };
}

export type V10EvidenceFollowUpStage = {
  dueMinus3DaysReminderDue: boolean;
  dueDateReminderDue: boolean;
  overdueStateDue: boolean;
  overdue: boolean;
  ownerNotificationDue: boolean;
  escalationWorkItemDue: boolean;
  diagnosticId: string | null;
};

export type V10EvidenceFollowUpSloEvidence = {
  measurement_key: "evidence_follow_up";
  included: boolean;
  owner_notification_due: boolean;
  escalation_work_item_due: boolean;
  retryable_diagnostic_id: string | null;
  objective_window: "pre_ga_release_candidate" | "post_ga_7_day" | "post_ga_30_day";
};

export function getV10EvidenceFollowUpStage(dueAt: string | null | undefined, now = new Date()): V10EvidenceFollowUpStage {
  if (!dueAt) {
    return {
      dueMinus3DaysReminderDue: false,
      dueDateReminderDue: false,
      overdueStateDue: false,
      overdue: false,
      ownerNotificationDue: false,
      escalationWorkItemDue: false,
      diagnosticId: "v10_evidence_due_date_missing",
    };
  }
  const schedule = getV10EvidenceFollowUpSchedule(dueAt, now);
  const current = now.getTime();
  const dueMinus3DaysReminderDue = current >= Date.parse(schedule.dueMinus3DaysAt);
  const dueDateReminderDue = current >= Date.parse(schedule.dueAt);
  const overdueStateDue = current >= Date.parse(schedule.overdueStateAt);
  const ownerNotificationDue = current >= Date.parse(schedule.ownerNotificationAt);
  const escalationWorkItemDue = current >= Date.parse(schedule.escalationWorkItemAt);
  return {
    dueMinus3DaysReminderDue,
    dueDateReminderDue,
    overdueStateDue,
    overdue: overdueStateDue,
    ownerNotificationDue,
    escalationWorkItemDue,
    diagnosticId: escalationWorkItemDue
      ? "v10_evidence_escalation_due"
      : ownerNotificationDue
        ? "v10_evidence_owner_notification_due"
        : overdueStateDue
          ? "v10_evidence_overdue"
          : dueDateReminderDue
            ? "v10_evidence_due_date_reminder_due"
            : dueMinus3DaysReminderDue
              ? "v10_evidence_due_minus_3_reminder_due"
              : null,
  };
}

export function buildV10EvidenceFollowUpSloEvidence(input: {
  dueAt?: string | null;
  accepted?: boolean;
  rejected?: boolean;
  now?: Date;
  objectiveWindow?: V10EvidenceFollowUpSloEvidence["objective_window"];
}): V10EvidenceFollowUpSloEvidence {
  const terminal = input.accepted === true || input.rejected === true;
  const stage = getV10EvidenceFollowUpStage(input.dueAt, input.now);
  return {
    measurement_key: "evidence_follow_up",
    included: Boolean(input.dueAt) && !terminal,
    owner_notification_due: stage.ownerNotificationDue,
    escalation_work_item_due: stage.escalationWorkItemDue,
    retryable_diagnostic_id: stage.diagnosticId,
    objective_window: input.objectiveWindow ?? "pre_ga_release_candidate",
  };
}

export function redactV10ExternalResponderState(value: string | null | undefined, redacted = false): V10ResponderIdentityState {
  if (redacted) return "redacted";
  return value?.trim() ? "provided" : "not_provided";
}

export function buildV10ExternalResponderPublicState(input: {
  tokenValid: boolean;
  expiresAt?: string | null;
  revokedAt?: string | null;
  responderContact?: string | null;
  responderRedacted?: boolean;
  status?: string | null;
  submissionCount?: number;
  resubmissionAllowed?: boolean;
  dueAt?: string | null;
  now?: Date;
}): V10ExternalResponderPublicState {
  const linkState = getV10ExternalLinkState(input);
  const accountabilityState = getV10EvidenceAccountabilityState({
    status: input.status,
    submissionCount: input.submissionCount,
    externalLinkState: linkState,
    resubmissionAllowed: input.resubmissionAllowed,
    dueAt: input.dueAt,
    now: input.now,
  });
  const canSubmit = linkState === "active" && ["awaiting_external", "overdue_follow_up"].includes(accountabilityState);
  const canResubmit = linkState === "active" && accountabilityState === "rejected_resubmission_allowed";
  return {
    link_state: linkState,
    responder_identity_state: redactV10ExternalResponderState(input.responderContact, input.responderRedacted),
    accountability_state: accountabilityState,
    can_submit: canSubmit,
    can_resubmit: canResubmit,
    user_visible_message:
      linkState === "expired"
        ? "This evidence link has expired. Request a fresh link from the workspace owner."
        : linkState === "revoked" || linkState === "invalid"
          ? "This evidence link is no longer available."
          : canResubmit
            ? "Your previous submission needs changes. You can resubmit from this link."
            : canSubmit
              ? "Submit evidence from this secure link."
              : "No evidence action is currently available from this link.",
    diagnostic_id:
      linkState === "expired"
        ? "v10_external_link_expired"
        : linkState === "revoked"
          ? "v10_external_link_revoked"
          : linkState === "invalid"
            ? "v10_external_link_invalid"
            : null,
  };
}

export function getV10EvidenceAccountabilityState(input: {
  status?: string | null;
  submissionCount?: number;
  externalLinkState?: "active" | "expired" | "revoked" | "not_created" | string | null;
  resubmissionAllowed?: boolean;
  dueAt?: string | null;
  now?: Date;
}): V10EvidenceAccountabilityState {
  if (!input.status) return "no_request";
  if (input.status === "accepted" || input.status === "approved") return "accepted";
  if (input.externalLinkState === "revoked") return "blocked_link_revoked";
  if (input.externalLinkState === "expired") return "blocked_link_expired";
  if (input.status === "rejected" && input.resubmissionAllowed) return "rejected_resubmission_allowed";
  if ((input.submissionCount ?? 0) > 0 || input.status === "submitted") return "ready_for_review";
  if (input.dueAt && getV10EvidenceFollowUpStage(input.dueAt, input.now).overdue) return "overdue_follow_up";
  return "awaiting_external";
}
