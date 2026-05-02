import type { OperationalTone } from "./operational-surface";

export type OperationalSeverity = "critical" | "high" | "medium" | "low" | "none";
export type OperationalDueState = "overdue" | "due_today" | "due_soon" | "scheduled" | "none";
export type OperationalPriorityKind =
  | "all_clear"
  | "blocked"
  | "contract_health"
  | "data_freshness"
  | "decision"
  | "evidence"
  | "failed_job"
  | "failed_report"
  | "ownership"
  | "recent_activity"
  | "renewal"
  | "routine"
  | "work";

export type OperationalPriorityInput = {
  id: string;
  kind: OperationalPriorityKind;
  title: string;
  count?: number | null;
  severity?: OperationalSeverity | string | null;
  dueState?: OperationalDueState | string | null;
  blocked?: boolean;
  ownerMissing?: boolean;
  failed?: boolean;
  stale?: boolean;
  decisionRequired?: boolean;
  updatedAt?: string | null;
};

export type OperationalPriorityResult = OperationalPriorityInput & {
  score: number;
  tone: OperationalTone;
  active: boolean;
};

const KIND_WEIGHT: Record<OperationalPriorityKind, number> = {
  failed_report: 92,
  failed_job: 90,
  data_freshness: 88,
  blocked: 84,
  evidence: 78,
  decision: 76,
  renewal: 70,
  contract_health: 66,
  ownership: 60,
  work: 54,
  recent_activity: 24,
  routine: 12,
  all_clear: 0,
};

function severityWeight(severity: string | null | undefined) {
  switch (severity) {
    case "critical":
      return 38;
    case "high":
      return 28;
    case "medium":
      return 14;
    case "low":
      return 6;
    default:
      return 0;
  }
}

function dueWeight(dueState: string | null | undefined) {
  switch (dueState) {
    case "overdue":
      return 34;
    case "due_today":
      return 24;
    case "due_soon":
      return 12;
    default:
      return 0;
  }
}

export function scoreOperationalPriority<T extends OperationalPriorityInput>(
  input: T
): OperationalPriorityResult & T {
  const count = input.count ?? 0;
  const active =
    count > 0 ||
    Boolean(input.blocked || input.ownerMissing || input.failed || input.stale || input.decisionRequired);
  const score =
    (active ? KIND_WEIGHT[input.kind] : 0) +
    severityWeight(input.severity) +
    dueWeight(input.dueState) +
    (input.blocked ? 22 : 0) +
    (input.failed ? 20 : 0) +
    (input.stale ? 18 : 0) +
    (input.decisionRequired ? 14 : 0) +
    (input.ownerMissing ? 10 : 0) +
    Math.min(Math.max(count, 0), 20);
  const tone: OperationalTone =
    !active
      ? "healthy"
      : score >= 90 || input.severity === "critical" || input.failed
        ? "risk"
        : score >= 55
          ? "attention"
          : "neutral";
  return { ...input, score, tone, active };
}

export function sortOperationalPriority<T extends OperationalPriorityInput>(items: T[]) {
  return [...items]
    .map((item) => scoreOperationalPriority(item))
    .sort((a, b) => {
      if (b.active !== a.active) return Number(b.active) - Number(a.active);
      if (b.score !== a.score) return b.score - a.score;
      const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      if (timeB !== timeA) return timeB - timeA;
      return a.title.localeCompare(b.title);
    });
}

export function summarizeOperationalCounts(items: OperationalPriorityInput[]) {
  const scored = sortOperationalPriority(items);
  const active = scored.filter((item) => item.active);
  const risk = active.filter((item) => item.tone === "risk");
  const attention = active.filter((item) => item.tone === "attention");
  return {
    scored,
    active,
    inactive: scored.filter((item) => !item.active),
    riskCount: risk.reduce((sum, item) => sum + (item.count ?? 1), 0),
    attentionCount: attention.reduce((sum, item) => sum + (item.count ?? 1), 0),
    isAllClear: active.length === 0,
  };
}
