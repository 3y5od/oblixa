import {
  type V10DueState,
  type V10OwnerState,
  type V10Priority,
  type V10Severity,
  type V10WorkItemStatus,
  type V10WorkItemType,
  type V10WorkLens,
} from "./release-contract";

export type V10WorkItemSemanticInput = {
  id: string;
  type: V10WorkItemType;
  status: V10WorkItemStatus;
  ownerUserId?: string | null;
  ownerActive?: boolean;
  ownerLastSignedInAt?: string | null;
  ownerRoleCanAct?: boolean;
  dueAt?: string | null;
  dateOnlyDue?: boolean;
  blockedReason?: string | null;
  priority?: V10Priority;
  severity?: V10Severity;
  healthScore?: number | null;
  contractValueUsd?: number | null;
  renewalNoticeDeadlineAt?: string | null;
  updatedAt?: string | null;
  assignedToCurrentUser?: boolean;
  assignedToCurrentTeam?: boolean;
};

export type V10DeterministicListKind =
  | "home"
  | "work"
  | "command_palette"
  | "contract_health"
  | "reports"
  | "jobs"
  | "search"
  | "recovery";

export type V10DeterministicSortInput = {
  kind: V10DeterministicListKind;
  rank?: number | null;
  priority?: V10Priority | null;
  dueState?: V10DueState | null;
  status?: string | null;
  updatedAt?: string | null;
  sourceId?: string | null;
  title?: string | null;
  stale?: boolean;
};

export type V10WorkReadModelRow = {
  type: string;
  source_id?: string | null;
  status: string;
  owner_user_id?: string | null;
  owner_state?: string | null;
  due_state: string | null;
  priority?: string | null;
  severity: string | null;
  compatible_action_group?: string | null;
  last_state_change_at?: string | null;
  updated_at: string | null;
};

export type V10WorkHubLensAlias =
  | "assigned"
  | "assigned_to_team"
  | "unassigned"
  | "due_today"
  | "due_soon"
  | "overdue"
  | "blocked"
  | "high_risk"
  | "recent"
  | "failed_jobs"
  | "automation_approvals";

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseV10DueDate(dueAt: string, dateOnly?: boolean): Date {
  if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    const [year, month, day] = dueAt.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  }
  return new Date(dueAt);
}

export function getV10DueState(
  dueAt: string | null | undefined,
  options?: { now?: Date; dateOnly?: boolean; dueSoonDays?: number }
): V10DueState {
  if (!dueAt) return "none";
  const now = options?.now ?? new Date();
  const due = parseV10DueDate(dueAt, options?.dateOnly);
  if (Number.isNaN(due.getTime())) return "none";
  const soonDays = options?.dueSoonDays ?? 8;
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const soonEnd = new Date(todayStart);
  soonEnd.setDate(todayStart.getDate() + 1 + soonDays);

  if (options?.dateOnly) {
    const dueDay = startOfLocalDay(due);
    if (dueDay < todayStart) return "overdue";
    if (dueDay >= todayStart && dueDay < tomorrowStart) return "due_today";
    if (dueDay < soonEnd) return "due_soon";
    return "none";
  }

  if (due < now) return "overdue";
  if (due >= todayStart && due < tomorrowStart) return "due_today";
  if (due < soonEnd) return "due_soon";
  return "none";
}

export function getV10OwnerState(
  input: Pick<V10WorkItemSemanticInput, "ownerUserId" | "ownerActive" | "ownerLastSignedInAt" | "ownerRoleCanAct">,
  now = new Date()
): V10OwnerState {
  if (!input.ownerUserId) return "unassigned";
  if (input.ownerActive === false || input.ownerRoleCanAct === false) return "stale";
  if (input.ownerLastSignedInAt) {
    const lastSeen = new Date(input.ownerLastSignedInAt);
    if (!Number.isNaN(lastSeen.getTime())) {
      const staleAfter = new Date(now);
      staleAfter.setDate(now.getDate() - 45);
      if (lastSeen < staleAfter) return "stale";
    }
  }
  return "assigned";
}

export function isV10BlockedWorkItem(item: V10WorkItemSemanticInput): boolean {
  return item.status === "blocked" || Boolean(item.blockedReason?.trim());
}

export function isV10HighRiskWorkItem(item: V10WorkItemSemanticInput, now = new Date()): boolean {
  if (item.severity === "critical" || item.severity === "high") return true;
  if ((item.healthScore ?? 100) < 60) return true;
  if ((item.contractValueUsd ?? 0) >= 250_000) return true;
  if (getV10DueState(item.dueAt, { now, dateOnly: item.dateOnlyDue }) === "overdue") return true;
  if (item.renewalNoticeDeadlineAt) {
    return getV10DueState(item.renewalNoticeDeadlineAt, { now, dueSoonDays: 30 }) !== "none";
  }
  return false;
}

export function getV10WorkLensMembership(item: V10WorkItemSemanticInput, now = new Date()): V10WorkLens[] {
  const dueState = getV10DueState(item.dueAt, { now, dateOnly: item.dateOnlyDue });
  const ownerState = getV10OwnerState(item, now);
  const lenses = new Set<V10WorkLens>();
  if (item.assignedToCurrentUser) lenses.add("assigned_to_me");
  if (item.assignedToCurrentTeam) lenses.add("assigned_to_my_team");
  if (ownerState === "unassigned") lenses.add("unassigned");
  if (dueState === "due_today") lenses.add("due_today");
  if (dueState === "due_soon") lenses.add("due_soon");
  if (dueState === "overdue") lenses.add("overdue");
  if (isV10BlockedWorkItem(item)) lenses.add("blocked");
  if (isV10HighRiskWorkItem(item, now)) lenses.add("high_risk");
  if (item.status === "done") lenses.add("recently_completed");
  if (item.type === "report_failure" || item.type === "export_failure" || item.type === "import_failure" || item.type === "extraction_failure") {
    lenses.add("failed_jobs");
  }
  if (item.type === "automation_approval") lenses.add("automation_approvals");
  return [...lenses];
}

function sortRank(item: V10WorkItemSemanticInput, now: Date): number {
  const dueState = getV10DueState(item.dueAt, { now, dateOnly: item.dateOnlyDue });
  if (isV10BlockedWorkItem(item) && isV10HighRiskWorkItem(item, now)) return 1;
  if (dueState === "overdue") return 2;
  if (dueState === "due_today") return 3;
  if (dueState === "due_soon") return 4;
  if (getV10WorkLensMembership(item, now).includes("failed_jobs")) return 5;
  if (item.type === "automation_approval") return 6;
  if (getV10OwnerState(item, now) === "unassigned") return 7;
  return 8;
}

export function compareV10WorkItems(a: V10WorkItemSemanticInput, b: V10WorkItemSemanticInput, now = new Date()): number {
  const rankDiff = sortRank(a, now) - sortRank(b, now);
  if (rankDiff !== 0) return rankDiff;
  return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
}

export function v10WorkReadModelSortRank(item: V10WorkReadModelRow): number {
  const highRisk = item.severity === "high" || item.severity === "critical";
  if (item.status === "blocked" && highRisk) return 0;
  if (item.due_state === "overdue") return 1;
  if (item.due_state === "due_today") return 2;
  if (item.due_state === "due_soon") return 3;
  if (["report_failure", "export_failure", "import_failure", "extraction_failure"].includes(item.type)) return 4;
  if (item.type === "automation_approval") return 5;
  if (item.type === "unassigned_work") return 6;
  return 7;
}

export function compareV10WorkReadModelRows(a: V10WorkReadModelRow, b: V10WorkReadModelRow): number {
  const rankDelta = v10WorkReadModelSortRank(a) - v10WorkReadModelSortRank(b);
  if (rankDelta !== 0) return rankDelta;
  const priorityRank = (value: string | null | undefined) =>
    value === "urgent" ? 0 : value === "high" ? 1 : value === "normal" ? 2 : value === "low" ? 3 : 4;
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  const changedDelta =
    Date.parse(b.last_state_change_at ?? b.updated_at ?? "1970-01-01T00:00:00Z") -
    Date.parse(a.last_state_change_at ?? a.updated_at ?? "1970-01-01T00:00:00Z");
  if (changedDelta !== 0) return changedDelta;
  return String(a.source_id ?? "").localeCompare(String(b.source_id ?? ""));
}

export function v10WorkReadModelAssignedToTeam(item: V10WorkReadModelRow, userId: string): boolean {
  return Boolean(item.owner_user_id) && item.owner_user_id !== userId && item.owner_state !== "unassigned";
}

export function v10WorkReadModelMatchesLens(
  item: V10WorkReadModelRow,
  userId: string,
  lens: V10WorkHubLensAlias
): boolean {
  const open = item.status !== "done";
  switch (lens) {
    case "assigned":
      return item.owner_user_id === userId && open;
    case "assigned_to_team":
      return v10WorkReadModelAssignedToTeam(item, userId) && open;
    case "unassigned":
      return item.owner_state === "unassigned" && open;
    case "due_today":
      return item.due_state === "due_today" && open;
    case "due_soon":
      return item.due_state === "due_soon" && open;
    case "overdue":
      return item.due_state === "overdue" && open;
    case "blocked":
      return item.status === "blocked";
    case "high_risk":
      return (
        item.severity === "high" ||
        item.severity === "critical" ||
        (item.due_state === "overdue" && ["approval", "evidence_request", "renewal_checkpoint"].includes(item.type))
      ) && open;
    case "recent":
      return item.status === "done" && Date.parse(item.updated_at ?? "1970-01-01T00:00:00Z") >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    case "failed_jobs":
      return ["report_failure", "export_failure", "import_failure", "extraction_failure"].includes(item.type) && open;
    case "automation_approvals":
      return item.type === "automation_approval" && open;
  }
}

export function getV10CompatibleActionGroup(item: V10WorkItemSemanticInput): string {
  return `${item.type}:${item.status}:owner:${getV10OwnerState(item)}:completion:${item.status === "done" ? "closed" : "open"}`;
}

const PRIORITY_RANK: Record<V10Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 };
const DUE_RANK: Record<V10DueState, number> = { overdue: 0, due_today: 1, due_soon: 2, none: 3 };

export function getV10DeterministicSortKey(input: V10DeterministicSortInput): string {
  const staleRank = input.stale ? 1 : 0;
  const rank = String(input.rank ?? 999).padStart(4, "0");
  const priority = String(input.priority ? PRIORITY_RANK[input.priority] : 9);
  const due = String(input.dueState ? DUE_RANK[input.dueState] : 9);
  const timestamp = input.updatedAt ? String(9_999_999_999_999 - new Date(input.updatedAt).getTime()).padStart(13, "0") : "9999999999999";
  const title = (input.title ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const sourceId = input.sourceId ?? "";
  return [input.kind, staleRank, rank, priority, due, input.status ?? "", timestamp, title, sourceId].join("|");
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { compareV10WorkItems as compareWorkItems };
export { compareV10WorkReadModelRows as compareWorkReadModelRows };
export { getV10CompatibleActionGroup as getCompatibleActionGroup };
export { getV10DeterministicSortKey as getDeterministicSortKey };
export { getV10DueState as getDueState };
export { getV10OwnerState as getOwnerState };
export { getV10WorkLensMembership as getWorkLensMembership };
export { isV10BlockedWorkItem as isBlockedWorkItem };
export { isV10HighRiskWorkItem as isHighRiskWorkItem };
export { v10WorkReadModelAssignedToTeam as workReadModelAssignedToTeam };
export { v10WorkReadModelMatchesLens as workReadModelMatchesLens };
export { v10WorkReadModelSortRank as workReadModelSortRank };
export type { V10DeterministicListKind as DeterministicListKind };
export type { V10DeterministicSortInput as DeterministicSortInput };
export type { V10WorkHubLensAlias as WorkHubLensAlias };
export type { V10WorkItemSemanticInput as WorkItemSemanticInput };
export type { V10WorkReadModelRow as WorkReadModelRow };
// End version-name compatibility aliases.
