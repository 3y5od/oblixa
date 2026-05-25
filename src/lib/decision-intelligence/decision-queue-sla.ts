export type SlaStatus = "overdue" | "due_soon" | "on_track" | "no_due_date";

export type QueuePriority = "high" | "medium" | "low" | "unspecified";

export function decisionQueueSlaFields(dueAt: string | null): {
  sla_status: SlaStatus;
  days_until_due: number | null;
  priority: QueuePriority;
} {
  if (!dueAt) {
    return { sla_status: "no_due_date", days_until_due: null, priority: "unspecified" };
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return { sla_status: "no_due_date", days_until_due: null, priority: "unspecified" };
  }
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  if (due.getTime() < now.getTime()) {
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / msPerDay);
    return { sla_status: "overdue", days_until_due: diffDays, priority: "high" };
  }
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / msPerDay);
  if (diffDays <= 3) {
    return { sla_status: "due_soon", days_until_due: diffDays, priority: "high" };
  }
  if (diffDays <= 7) {
    return { sla_status: "due_soon", days_until_due: diffDays, priority: "medium" };
  }
  return { sla_status: "on_track", days_until_due: diffDays, priority: "low" };
}
