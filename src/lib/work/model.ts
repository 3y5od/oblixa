import { differenceInCalendarDays, formatDistanceToNowStrict, isValid } from "date-fns";
import type { createAdminClient } from "@/lib/supabase/server";
import { getV10WorkItemHref } from "@/lib/job-routing";
import { applyV10ReadModelVisibility } from "@/lib/visibility";
import { loadOrgMemberProfileRows, orgMemberProfileLabel, type OrgMemberProfileRow } from "@/lib/org-member-profiles";
import {
  WORK_ACTION_LABELS,
  WORK_EMPTY_STATE,
  WORK_EYEBROW,
  WORK_PAGE_TITLE,
  WORK_PRIMARY_CTA,
  WORK_ROW_LABELS,
  WORK_STATUS_LABELS,
  WORK_TAB_LABELS,
  WORK_TYPE_LABELS,
} from "./spec-strings";
import type {
  WorkActionCapability,
  WorkDueFilterKey,
  WorkFilterState,
  WorkItemRow,
  WorkModelLoadInput,
  WorkModelSearchInput,
  WorkOption,
  WorkPageModel,
  WorkStatusFilterKey,
  WorkTabKey,
  WorkTypeKey,
} from "./types";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export const WORK_TAB_ORDER = [
  "all",
  "my_work",
  "overdue",
  "blocked",
  "approvals",
  "obligations",
  "exceptions",
] as const satisfies readonly WorkTabKey[];

export const CORE_WORK_ITEM_TYPES = [
  "contract_task",
  "obligation",
  "approval",
  "exception",
  "evidence_request",
  "renewal_checkpoint",
  "unassigned_work",
] as const satisfies readonly WorkTypeKey[];

const TERMINAL_STATUSES = new Set(["done", "canceled", "cancelled", "completed", "resolved", "closed"]);

const DUE_FILTER_OPTIONS: WorkOption[] = [
  { value: "", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "due_today", label: "Due today" },
  { value: "due_soon", label: "Due soon" },
  { value: "no_due", label: "No due date" },
];

const STATUS_FILTER_OPTIONS: WorkOption[] = [
  { value: "", label: "Active" },
  ...Object.entries(WORK_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const TYPE_FILTER_OPTIONS: WorkOption[] = [
  { value: "", label: "Any type" },
  ...CORE_WORK_ITEM_TYPES.map((value) => ({ value, label: WORK_TYPE_LABELS[value] })),
];

export type WorkReadModelRow = {
  id?: string | null;
  source_id?: string | null;
  source_table?: string | null;
  type?: string | null;
  title?: string | null;
  status?: string | null;
  contract_id?: string | null;
  owner_user_id?: string | null;
  owner_state?: string | null;
  due_at?: string | null;
  due_state?: string | null;
  priority?: string | null;
  severity?: string | null;
  blocked_reason?: string | null;
  primary_action?: string | null;
  last_state_change_at?: string | null;
  updated_at?: string | null;
};

export type WorkContractOptionRow = {
  id: string;
  title: string | null;
  counterparty?: string | null;
  updated_at?: string | null;
};

export type BuildWorkPageModelInput = WorkModelLoadInput & {
  rows: WorkReadModelRow[];
  contracts: WorkContractOptionRow[];
  members: OrgMemberProfileRow[];
  warnings?: string[];
  /** Render-time clock for overdue derivation. Defaults to `new Date()`.
   *  Injectable so tab counts/tone reflect "now" rather than the read
   *  model's projection-time `due_state`, which goes stale between runs. */
  now?: Date;
};

export function normalizeWorkTab(input: { tab?: string | null; lens?: string | null }): WorkTabKey {
  const tab = normalizeToken(input.tab);
  if (isWorkTabKey(tab)) return tab;

  const lens = normalizeToken(input.lens);
  if (lens === "assigned" || lens === "assigned_to_me") return "my_work";
  if (lens === "overdue") return "overdue";
  if (lens === "blocked") return "blocked";
  if (lens === "automation_approvals") return "approvals";
  return "all";
}

export function normalizeWorkFilters(input: WorkModelSearchInput): WorkFilterState {
  const due = normalizeToken(input.due);
  const status = normalizeToken(input.status);
  const type = normalizeToken(input.type);
  return {
    owner: normalizeToken(input.owner),
    dueDate: isWorkDueFilterKey(due) ? due : "",
    contract: normalizeToken(input.contract),
    status: isWorkStatusFilterKey(status) ? status : "",
    type: isWorkTypeKey(type) ? type : "",
  };
}

export function buildWorkHref(input: {
  tab?: WorkTabKey;
  filters?: WorkFilterState;
  create?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.tab && input.tab !== "all") params.set("tab", input.tab);
  const filters = input.filters;
  if (filters) {
    if (filters.owner) params.set("owner", filters.owner);
    if (filters.dueDate) params.set("due", filters.dueDate);
    if (filters.contract) params.set("contract", filters.contract);
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
  }
  if (input.create) params.set("create", "1");
  const qs = params.toString();
  return qs ? `/work?${qs}` : "/work";
}

export function buildWorkPageModel(input: BuildWorkPageModelInput): WorkPageModel {
  const activeTab = normalizeWorkTab(input);
  const filters = normalizeWorkFilters(input);
  const contractById = new Map(input.contracts.map((contract) => [contract.id, contract]));
  const ownerLabelById = new Map(
    input.members.map((member) => [member.user_id, orgMemberProfileLabel(member.profiles)])
  );

  const now = input.now ?? new Date();
  const shapedRows = input.rows
    .filter((row) => isWorkTypeKey(normalizeToken(row.type)))
    .map((row) => shapeWorkRow(row, {
      userId: input.userId,
      contractById,
      ownerLabelById,
      now,
    }))
    .filter((row): row is WorkItemRow => row !== null);

  const activeRows = filters.status ? shapedRows : shapedRows.filter((row) => !TERMINAL_STATUSES.has(row.status));
  const filteredWithoutTab = activeRows.filter((row) => matchesFilters(row, filters));
  const tabs = WORK_TAB_ORDER.map((key) => ({
    key,
    label: WORK_TAB_LABELS[key],
    count: filteredWithoutTab.filter((row) => matchesTab(row, key, input.userId)).length,
    href: buildWorkHref({ tab: key, filters }),
    active: key === activeTab,
  }));
  const rows = filteredWithoutTab
    .filter((row) => matchesTab(row, activeTab, input.userId))
    .sort(compareWorkRows);

  const contractOptions = toContractOptions(input.contracts);
  const ownerOptions = toOwnerOptions(input.members);

  return {
    title: WORK_PAGE_TITLE,
    eyebrow: WORK_EYEBROW,
    primaryCta: WORK_PRIMARY_CTA,
    activeTab,
    filters,
    tabs,
    rows,
    totalVisibleRows: filteredWithoutTab.length,
    filterOptions: {
      owners: [{ value: "", label: "Any owner" }, { value: "unassigned", label: "Unassigned" }, ...ownerOptions],
      contracts: [{ value: "", label: "Any contract" }, ...contractOptions],
      statuses: STATUS_FILTER_OPTIONS,
      types: TYPE_FILTER_OPTIONS,
      dueDates: DUE_FILTER_OPTIONS,
    },
    create: {
      open: input.create === "1" || input.create === "true",
      contracts: contractOptions,
      ownerOptions,
      typeOptions: TYPE_FILTER_OPTIONS.filter((option) => option.value),
    },
    warnings: input.warnings ?? [],
  };
}

export async function loadWorkPageModel(
  admin: AdminClient,
  orgId: string,
  input: WorkModelLoadInput
): Promise<WorkPageModel> {
  const warnings: string[] = [];
  let workQuery = applyV10ReadModelVisibility(
    admin
      .from("v10_work_items")
      .select("id, source_id, source_table, type, title, status, contract_id, owner_user_id, owner_state, due_at, due_state, priority, severity, blocked_reason, primary_action, last_state_change_at, updated_at"),
    {
      organizationId: orgId,
      role: input.role,
      workspaceMode: input.workspaceMode ?? "core",
    }
  );
  workQuery = workQuery.in("type", CORE_WORK_ITEM_TYPES);

  const { data: workRows, error: workError } = await workQuery
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (workError) warnings.push("work_items");

  const contractIds = Array.from(
    new Set(((workRows ?? []) as WorkReadModelRow[]).map((row) => row.contract_id).filter(Boolean) as string[])
  );

  const contractMap = new Map<string, WorkContractOptionRow>();
  if (contractIds.length > 0) {
    const { data: linkedContracts, error: linkedContractsError } = await admin
      .from("contracts")
      .select("id, title, counterparty, updated_at")
      .eq("organization_id", orgId)
      .in("id", contractIds);
    if (linkedContractsError) warnings.push("linked_contracts");
    for (const contract of (linkedContracts ?? []) as WorkContractOptionRow[]) {
      contractMap.set(contract.id, contract);
    }
  }

  const { data: contractOptions, error: contractOptionsError } = await admin
    .from("contracts")
    .select("id, title, counterparty, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (contractOptionsError) warnings.push("contracts");
  for (const contract of (contractOptions ?? []) as WorkContractOptionRow[]) {
    contractMap.set(contract.id, contract);
  }

  const members = await loadOrgMemberProfileRows(admin, orgId, {
    memberColumns: "id, organization_id, user_id, role, created_at",
    orderByCreatedAt: true,
    limit: 200,
  });

  return buildWorkPageModel({
    ...input,
    rows: (workRows ?? []) as WorkReadModelRow[],
    contracts: Array.from(contractMap.values()),
    members,
    warnings,
  });
}

export { WORK_EMPTY_STATE };

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isWorkTabKey(value: string): value is WorkTabKey {
  return (WORK_TAB_ORDER as readonly string[]).includes(value);
}

function isWorkTypeKey(value: string): value is WorkTypeKey {
  return (CORE_WORK_ITEM_TYPES as readonly string[]).includes(value);
}

function isWorkDueFilterKey(value: string): value is WorkDueFilterKey {
  return ["", "overdue", "due_today", "due_soon", "no_due"].includes(value);
}

function isWorkStatusFilterKey(value: string): value is WorkStatusFilterKey {
  return ["", "open", "in_progress", "blocked", "waiting", "done", "canceled"].includes(value);
}

function shapeWorkRow(
  row: WorkReadModelRow,
  input: {
    userId: string;
    contractById: Map<string, WorkContractOptionRow>;
    ownerLabelById: Map<string, string>;
    now: Date;
  }
): WorkItemRow | null {
  const type = normalizeToken(row.type);
  if (!isWorkTypeKey(type)) return null;
  const sourceId = normalizeToken(row.source_id || row.id);
  const sourceTable = normalizeToken(row.source_table) || type;
  const id = normalizeToken(row.id) || `${sourceTable}:${sourceId}`;
  const contractId = row.contract_id ?? null;
  const contract = contractId ? input.contractById.get(contractId) : null;
  const status = normalizeToken(row.status) || "open";
  const href = getV10WorkItemHref({
    type,
    sourceId,
    contractId,
    primaryAction: row.primary_action,
    fallbackHref: "/work",
  });
  const contractHref = contractId ? `/contracts/${contractId}` : null;
  const ownerUserId = row.owner_user_id ?? null;
  const ownerLabel =
    row.owner_state === "unassigned"
      ? "Unassigned"
      : ownerUserId === input.userId
        ? "You"
        : ownerUserId
          ? input.ownerLabelById.get(ownerUserId) ?? "Assigned teammate"
          : "Unassigned";
  const dueAt = row.due_at ?? null;
  // Derive freshness from due_at vs the render clock rather than trusting
  // the read model's `due_state` column — that value is computed at
  // projection time and goes stale, so a date 9 days past can still report
  // "due_soon"/"none" and never surface in the Overdue tab.
  const { dueState, dueInDays } = deriveDueMeta(dueAt, input.now);
  const blocker = normalizeToken(row.blocked_reason) || (status === "blocked" ? "Blocked" : "—");
  const lastUpdateAt = row.last_state_change_at ?? row.updated_at ?? null;
  const title = normalizeToken(row.title) || WORK_TYPE_LABELS[type];
  const contractTitle = contract?.title || (contractId ? "Untitled contract" : "—");
  const dueLabel = formatDateLabel(dueAt);
  const lastUpdateLabel = formatRelativeLabel(lastUpdateAt);
  const statusLabel = formatStatusLabel(status);
  const typeLabel = WORK_TYPE_LABELS[type];
  return {
    id,
    key: `${sourceTable}:${sourceId}:${type}`,
    sourceId,
    sourceTable,
    type,
    typeLabel,
    title,
    status,
    statusLabel,
    statusTone: statusTone(status, dueState, normalizeToken(row.severity)),
    contractId,
    contractTitle,
    contractHref,
    ownerUserId,
    ownerLabel,
    dueAt,
    dueLabel,
    dueState,
    dueInDays,
    blocker,
    lastUpdateAt,
    lastUpdateLabel,
    href,
    display: {
      identity: {
        title: { label: WORK_ROW_LABELS.title, value: title, href },
        linkedContract: {
          label: WORK_ROW_LABELS.linkedContract,
          value: contractTitle,
          href: contractHref,
        },
      },
      ownership: {
        owner: { label: WORK_ROW_LABELS.owner, value: ownerLabel },
        dueDate: { label: WORK_ROW_LABELS.dueDate, value: dueLabel },
        lastUpdate: { label: WORK_ROW_LABELS.lastUpdate, value: lastUpdateLabel },
      },
      state: {
        status: { label: WORK_ROW_LABELS.status, value: statusLabel },
        type: { label: WORK_ROW_LABELS.type, value: typeLabel },
        // "—" is the no-blocker sentinel (also read by the `blocked` tab
        // filter); surface it verbatim per §10.12 rather than spelling out
        // "None".
        blocker: { label: WORK_ROW_LABELS.blocker, value: blocker },
      },
    },
    actions: buildActionCapabilities({ type, status, sourceId, contractId, href, contractHref }),
  };
}

function buildActionCapabilities(input: {
  type: WorkTypeKey;
  status: string;
  sourceId: string;
  contractId: string | null;
  href: string;
  contractHref: string | null;
}): WorkActionCapability[] {
  const evidenceHref = input.contractId ? `/contracts/${input.contractId}?tab=overview#contract-evidence` : input.href;
  const notesHref = input.contractId ? `/contracts/${input.contractId}?tab=notes` : input.href;
  const completeMutation =
    input.type === "contract_task" && ["open", "in_progress"].includes(input.status)
      ? "complete_task"
      : input.type === "obligation" && ["open", "in_progress"].includes(input.status)
        ? "complete_obligation"
        : null;
  return [
    completeMutation
      ? {
          key: "complete",
          label: WORK_ACTION_LABELS.complete,
          kind: "mutation",
          mutation: completeMutation,
        }
      : {
          key: "complete",
          label: WORK_ACTION_LABELS.complete,
          kind: "link",
          href: input.href,
        },
    { key: "reassign", label: WORK_ACTION_LABELS.reassign, kind: "link", href: input.href },
    { key: "change_due_date", label: WORK_ACTION_LABELS.change_due_date, kind: "link", href: input.href },
    { key: "comment", label: WORK_ACTION_LABELS.comment, kind: "link", href: notesHref },
    { key: "link_evidence", label: WORK_ACTION_LABELS.link_evidence, kind: "link", href: evidenceHref },
    { key: "escalate", label: WORK_ACTION_LABELS.escalate, kind: "link", href: input.href },
  ];
}

function matchesFilters(row: WorkItemRow, filters: WorkFilterState) {
  if (filters.owner) {
    if (filters.owner === "unassigned") {
      if (row.ownerUserId) return false;
    } else if (row.ownerUserId !== filters.owner) {
      return false;
    }
  }
  if (filters.contract && row.contractId !== filters.contract) return false;
  if (filters.status && row.status !== filters.status) return false;
  if (filters.type && row.type !== filters.type) return false;
  if (filters.dueDate === "no_due" && row.dueAt) return false;
  if (filters.dueDate && filters.dueDate !== "no_due" && row.dueState !== filters.dueDate) return false;
  return true;
}

function matchesTab(row: WorkItemRow, tab: WorkTabKey, userId: string) {
  switch (tab) {
    case "all":
      return true;
    case "my_work":
      return row.ownerUserId === userId;
    case "overdue":
      return row.dueState === "overdue";
    case "blocked":
      return row.status === "blocked" || row.blocker !== "—";
    case "approvals":
      return row.type === "approval";
    case "obligations":
      return row.type === "obligation";
    case "exceptions":
      return row.type === "exception";
  }
}

function compareWorkRows(a: WorkItemRow, b: WorkItemRow) {
  const statusRank = (row: WorkItemRow) =>
    row.status === "blocked" ? 0 : row.dueState === "overdue" ? 1 : row.dueAt ? 2 : 3;
  const rankDelta = statusRank(a) - statusRank(b);
  if (rankDelta !== 0) return rankDelta;
  if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;
  return (b.lastUpdateAt ?? "").localeCompare(a.lastUpdateAt ?? "");
}

function toContractOptions(contracts: WorkContractOptionRow[]): WorkOption[] {
  return contracts
    .map((contract) => ({ value: contract.id, label: contract.title || "Untitled contract" }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function toOwnerOptions(members: OrgMemberProfileRow[]): WorkOption[] {
  return members
    .map((member) => ({ value: member.user_id, label: orgMemberProfileLabel(member.profiles) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function formatStatusLabel(status: string) {
  if (status in WORK_STATUS_LABELS) {
    return WORK_STATUS_LABELS[status as keyof typeof WORK_STATUS_LABELS];
  }
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTone(status: string, dueState: string, severity: string) {
  if (severity === "critical") return "critical";
  if (dueState === "overdue") return "overdue";
  if (status === "blocked") return "blocked";
  if (status === "waiting") return "warning";
  if (status === "in_progress") return "info";
  if (status === "done") return "healthy";
  if (status === "canceled" || status === "cancelled") return "disabled";
  return "in_review";
}

function deriveDueMeta(
  dueAt: string | null,
  now: Date
): { dueState: string; dueInDays: number | null } {
  if (!dueAt) return { dueState: "none", dueInDays: null };
  const due = new Date(dueAt);
  if (!isValid(due)) return { dueState: "none", dueInDays: null };
  const dueInDays = differenceInCalendarDays(due, now);
  const dueState =
    dueInDays < 0
      ? "overdue"
      : dueInDays === 0
        ? "due_today"
        : dueInDays <= 7
          ? "due_soon"
          : "none";
  return { dueState, dueInDays };
}

function formatDateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}
