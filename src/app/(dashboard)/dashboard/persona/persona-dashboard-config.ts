import type { OperationalTone } from "@/lib/ui/operational-surface";

export const PERSONA_CONFIG = {
  ops: {
    label: "Ops lead",
    purpose: "Handle tasks that need input or high-priority tasks before routine follow-up.",
    queueTitle: "Ops task queue",
    queueDescription: "Tasks needing input, due tasks, and high-priority tasks are listed first.",
    emptyMessage: "No Ops tasks needing input or high-priority Ops tasks are visible for your current workspace and role.",
  },
  finance: {
    label: "Finance",
    purpose: "Clear renewal dependencies and financial exposure that needs a decision.",
    queueTitle: "Renewal dependency queue",
    queueDescription: "Renewals needing input and dependency-bearing decisions are listed first.",
    emptyMessage: "No renewal decisions needing input are visible for your current workspace and role.",
  },
  legal: {
    label: "Legal reviewer",
    purpose: "Review pending approvals before downstream tasks stall.",
    queueTitle: "Legal approval queue",
    queueDescription: "Pending sign-offs are ordered by urgency and due date.",
    emptyMessage: "No pending legal approvals are visible for your current workspace and role.",
  },
  account_owner: {
    label: "Account owner",
    purpose: "Follow up on assigned tasks and obligations that need your attention.",
    queueTitle: "Assigned task queue",
    queueDescription: "Your tasks needing input, overdue tasks, due tasks, and high-priority tasks are listed first.",
    emptyMessage: "No assigned tasks or obligations are visible for your current workspace and role.",
  },
  reviewer: {
    label: "Contract coordinator",
    purpose: "Coordinate open contract tasks that need triage or follow-up.",
    queueTitle: "Coordination queue",
    queueDescription: "Coordination tasks needing input and high-priority coordination tasks are listed first.",
    emptyMessage: "No coordination tasks are visible for your current workspace and role.",
  },
  manager: {
    label: "Founder / manager",
    purpose: "Review dependencies, approvals, and ownership gaps that need escalation.",
    queueTitle: "Manager escalation queue",
    queueDescription: "Renewal dependencies and pending approvals are combined by urgency.",
    emptyMessage: "No approvals, dependencies, or ownership gaps are visible for your current workspace and role.",
  },
} as const;

export type PersonaId = keyof typeof PERSONA_CONFIG;
export type PersonaViewConfig = (typeof PERSONA_CONFIG)[PersonaId];
export type ContractRelation = { id?: string; title?: string; organization_id?: string } | null;

export type PersonaQueueItem = {
  id: string;
  href: string;
  title: string;
  contractTitle?: string;
  ownerLabel?: string;
  dueLabel?: string;
  reason: string;
  actionLabel: string;
  urgency: "blocked" | "overdue" | "due_today" | "high" | "normal";
  dueDate?: string;
};

export const PERSONAS = Object.entries(PERSONA_CONFIG).map(([id, config]) => ({
  id: id as PersonaId,
  label: config.label,
}));

export const PERSONA_PRESETS: Array<{
  id: string;
  label: string;
  persona: PersonaId;
  description: string;
  href: string;
}> = [
  {
    id: "ops-daily",
    label: "Ops Daily",
    persona: "ops",
    description: "Run tasks + obligations + intake triage",
    href: "/dashboard/persona?persona=ops",
  },
  {
    id: "legal-approvals",
    label: "Legal Approvals",
    persona: "legal",
    description: "Clear approval queue and exceptions",
    href: "/dashboard/persona?persona=legal",
  },
  {
    id: "finance-renewals",
    label: "Finance Renewals",
    persona: "finance",
    description: "Prioritize high-value renewal exposure",
    href: "/dashboard/persona?persona=finance",
  },
  {
    id: "manager-overview",
    label: "Manager Weekly",
    persona: "manager",
    description: "Portfolio risk and execution posture",
    href: "/dashboard/persona?persona=manager",
  },
];

export const ALL_CLEAR_ACTION_LABELS: Record<(typeof PERSONA_PRESETS)[number]["id"], string> = {
  "ops-daily": "Browse Ops Daily",
  "legal-approvals": "Review legal approvals",
  "finance-renewals": "Inspect renewal dependencies",
  "manager-overview": "Review escalations",
};

const urgencyRank = {
  blocked: 0,
  overdue: 1,
  due_today: 2,
  high: 3,
  normal: 4,
} as const;

export function relationContract(rel: unknown): ContractRelation {
  return (Array.isArray(rel) ? rel[0] : rel) as ContractRelation;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function dueLabel(value: string | null | undefined) {
  return value ? `Due ${String(value).slice(0, 10)}` : undefined;
}

export function readableStatus(value: string | null | undefined) {
  return String(value ?? "open").replaceAll("_", " ");
}

export function urgencyFrom(
  status?: string | null,
  due?: string | null,
  priority?: string | null
): PersonaQueueItem["urgency"] {
  const dueKey = due ? String(due).slice(0, 10) : "";
  const today = todayKey();
  if (status === "blocked") return "blocked";
  if (dueKey && dueKey < today) return "overdue";
  if (dueKey && dueKey === today) return "due_today";
  if (priority === "high") return "high";
  return "normal";
}

export function sortQueueItems(items: PersonaQueueItem[]) {
  return [...items].sort((a, b) => {
    const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (rankDiff !== 0) return rankDiff;
    const aDue = a.dueDate ?? "9999-12-31";
    const bDue = b.dueDate ?? "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return a.title.localeCompare(b.title);
  });
}

export function rowTone(urgency: PersonaQueueItem["urgency"]): OperationalTone {
  if (urgency === "blocked" || urgency === "overdue") return "risk";
  if (urgency === "due_today" || urgency === "high") return "attention";
  return "neutral";
}
