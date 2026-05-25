/** Max characters for in-app notification body preview (V9 §18.5 — bounded client payload). */
export const V9_IN_APP_NOTIFICATION_BODY_MAX = 480;

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
    return "Obligation due";
  }
  if (notificationType === "renewal_due") {
    return "Renewal due";
  }
  if (notificationType === "exception_assigned") {
    return "Exception assignment";
  }
  if (notificationType === "review_backlog") {
    return "Review backlog";
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
    return "Open assigned work";
  }
  if (notificationType === "obligation_due") {
    return "Open obligations";
  }
  if (notificationType === "renewal_due") {
    return "Open renewals";
  }
  if (notificationType === "exception_assigned") {
    return "Open exceptions";
  }
  if (notificationType === "review_backlog") {
    return "Open review queue";
  }
  if (notificationType === "saved_view_summary") {
    return "Open saved view reports";
  }
  if (notificationType === "reminder_due") {
    return "Open upcoming work";
  }
  return "Open related workspace";
}

export function truncateInAppNotificationBody(
  body: string | null | undefined,
  maxLen: number = V9_IN_APP_NOTIFICATION_BODY_MAX
): string {
  const t = String(body ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen - 1).trimEnd();
  return slice.length > 0 ? `${slice}…` : "…";
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V9_IN_APP_NOTIFICATION_BODY_MAX as IN_APP_NOTIFICATION_BODY_MAX };
// End version-name compatibility aliases.
