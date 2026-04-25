type ExceptionPriorityRow = {
  status: string | null;
  severity: string | null;
  due_date: string | null;
  updated_at: string;
};

export function severityRank(severity: string | null | undefined): number {
  switch (severity) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

export function compareExceptionsByPriority(
  a: ExceptionPriorityRow,
  b: ExceptionPriorityRow
): number {
  const actionableDiff =
    (a.status === "resolved" || a.status === "closed" ? 1 : 0) -
    (b.status === "resolved" || b.status === "closed" ? 1 : 0);
  if (actionableDiff !== 0) return actionableDiff;

  const severityDiff = severityRank(a.severity) - severityRank(b.severity);
  if (severityDiff !== 0) return severityDiff;

  const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
  const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;

  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}
