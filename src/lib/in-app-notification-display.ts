/** Max characters for in-app notification body preview. */
export const IN_APP_NOTIFICATION_BODY_MAX = 480;
export const V9_IN_APP_NOTIFICATION_BODY_MAX = IN_APP_NOTIFICATION_BODY_MAX;

export function getInAppNotificationTypeLabel(
  notificationType: string | null | undefined,
  entityType?: string | null
): string {
  if (notificationType === "approval_requested" || entityType === "contract_approval") {
    return "Approval request";
  }
  if (notificationType === "approval_resolved") {
    return "Approval update";
  }
  if (notificationType === "mention" || entityType === "field_comment") {
    return "Comment mention";
  }
  if (notificationType === "task_assigned") {
    return "Task assignment";
  }
  if (notificationType === "obligation_due") {
    return "Requirement due";
  }
  if (notificationType === "renewal_due") {
    return "Renewal due";
  }
  if (notificationType === "exception_assigned") {
    return "Issue assignment";
  }
  if (notificationType === "review_backlog") {
    return "Detail confirmation backlog";
  }
  if (notificationType === "saved_view_summary") {
    return "Saved view digest";
  }
  if (notificationType === "reminder_due") {
    return "Upcoming reminder";
  }
  return "Notification";
}

export function getInAppNotificationCtaLabel(
  notificationType: string | null | undefined,
  entityType?: string | null
): string {
  if (notificationType === "approval_requested" || entityType === "contract_approval") {
    return "Open approval";
  }
  if (notificationType === "approval_resolved") {
    return "Open approvals";
  }
  if (notificationType === "mention" || entityType === "field_comment") {
    return "Open comment thread";
  }
  if (notificationType === "task_assigned") {
    return "Open assigned task";
  }
  if (notificationType === "obligation_due") {
    return "Open requirements";
  }
  if (notificationType === "renewal_due") {
    return "Open renewals";
  }
  if (notificationType === "exception_assigned") {
    return "Open issues";
  }
  if (notificationType === "review_backlog") {
    return "Open confirmation queue";
  }
  if (notificationType === "saved_view_summary") {
    return "Open saved view reports";
  }
  if (notificationType === "reminder_due") {
    return "Open upcoming task";
  }
  return "Open related workspace";
}

export function truncateInAppNotificationBody(
  body: string | null | undefined,
  maxLen: number = IN_APP_NOTIFICATION_BODY_MAX
): string {
  const t = String(body ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen - 1).trimEnd();
  return slice.length > 0 ? `${slice}…` : "…";
}
