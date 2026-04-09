export type WorkflowHealth = "healthy" | "watch" | "at_risk" | "unknown";

export function normalizeIsoDate(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  const date = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function addDaysIsoDate(baseDate: string, days: number): string | null {
  const normalizedBase = normalizeIsoDate(baseDate);
  if (!normalizedBase) return null;
  const date = new Date(`${normalizedBase}T12:00:00`);
  date.setDate(date.getDate() + Math.trunc(days));
  return date.toISOString().slice(0, 10);
}

export function normalizeWorkflowText(
  value: string | null | undefined,
  maxLen: number
): string | null {
  const normalized = value?.trim() || null;
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

export function deriveWorkflowHealthScore(input: {
  hasOwner: boolean;
  missingCriticalDates: boolean;
  overdueTasks: number;
  overdueObligations: number;
  pendingApprovals: number;
  hasBlockers: boolean;
}): WorkflowHealth {
  if (
    !input.hasOwner ||
    input.missingCriticalDates ||
    input.overdueTasks > 0 ||
    input.overdueObligations > 0 ||
    input.pendingApprovals > 0 ||
    input.hasBlockers
  ) {
    return "at_risk";
  }
  if (input.pendingApprovals > 0) return "watch";
  return "healthy";
}
