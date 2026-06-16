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
  WORK_PRIMARY_ACTION_LABELS,
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
  WorkPrimaryAction,
  WorkSortKey,
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
  { value: "overdue", label: "Past due" },
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

const SORT_OPTIONS: WorkOption[] = [
  { value: "urgency", label: "Urgency" },
  { value: "due", label: "Due date" },
  { value: "updated", label: "Recently updated" },
  { value: "owner", label: "Owner" },
  { value: "type", label: "Type" },
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

export const WORK_PAGE_SIZE = 25;

export function buildWorkHref(input: {
  tab?: WorkTabKey;
  filters?: WorkFilterState;
  create?: boolean;
  page?: number;
  sort?: WorkSortKey;
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
  if (input.sort && input.sort !== "urgency") params.set("sort", input.sort);
  // Page 1 stays a clean URL; anything else (tab/filter change) drops the page
  // entirely by not passing it, so the view resets to the first page.
  if (input.page && input.page > 1) params.set("page", String(input.page));
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
  const sortKey = isWorkSortKey(normalizeToken(input.sort))
    ? (normalizeToken(input.sort) as WorkSortKey)
    : "urgency";
  // Sort is a view preference — keep it on the tab links so switching tabs
  // doesn't silently revert to the default ordering.
  const tabs = WORK_TAB_ORDER.map((key) => ({
    key,
    label: WORK_TAB_LABELS[key],
    count: filteredWithoutTab.filter((row) => matchesTab(row, key, input.userId)).length,
    href: buildWorkHref({ tab: key, filters, sort: sortKey }),
    active: key === activeTab,
  }));
  const tabRows = filteredWithoutTab
    .filter((row) => matchesTab(row, activeTab, input.userId))
    .sort(workComparator(sortKey));
  const visibleContractCount = new Set(
    tabRows.map((row) => row.contractId).filter((id): id is string => Boolean(id))
  ).size;

  // Paginate the active tab so the page never renders hundreds of rows in one
  // scroll. Tab counts above stay full (computed over filteredWithoutTab).
  const total = tabRows.length;
  const totalPages = Math.max(1, Math.ceil(total / WORK_PAGE_SIZE));
  const requestedPage = Number.parseInt(normalizeToken(input.page), 10);
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const rows = tabRows.slice((page - 1) * WORK_PAGE_SIZE, page * WORK_PAGE_SIZE);

  const contractOptions = toContractOptions(input.contracts);
  const ownerOptions = toOwnerOptions(input.members);

  // Queue-wide KPI counts over the same filtered (pre-tab) set the tab counts
  // use, so the header strip and the tabs always agree. Predicates mirror the
  // blocked/overdue tab matchers (see matchesTab).
  const summary = {
    blocked: filteredWithoutTab.filter((row) => row.status === "blocked" || row.blocker !== "—").length,
    overdue: filteredWithoutTab.filter((row) => row.dueState === "overdue").length,
    dueSoon: filteredWithoutTab.filter((row) => row.dueState === "due_soon" || row.dueState === "due_today").length,
    unassigned: filteredWithoutTab.filter((row) => !row.ownerUserId).length,
  };

  // Stable facet totals over the full pre-filter set (mirrors Evidence): a count
  // is "how many work items carry this value", so it stays put as you filter.
  const statusCounts = new Map<string, number>();
  const dueCounts = new Map<string, number>();
  for (const row of shapedRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    dueCounts.set(row.dueState, (dueCounts.get(row.dueState) ?? 0) + 1);
  }
  const withCount = (options: WorkOption[], counts: Map<string, number>): WorkOption[] =>
    options.map((option) =>
      option.value ? { ...option, count: counts.get(option.value) ?? 0 } : option
    );

  return {
    title: WORK_PAGE_TITLE,
    eyebrow: WORK_EYEBROW,
    primaryCta: WORK_PRIMARY_CTA,
    activeTab,
    filters,
    tabs,
    rows,
    totalVisibleRows: filteredWithoutTab.length,
    visibleContractCount,
    pagination: { page, pageSize: WORK_PAGE_SIZE, total, totalPages },
    sort: sortKey,
    sortOptions: SORT_OPTIONS,
    summary,
    filterOptions: {
      owners: [{ value: "", label: "Any owner" }, { value: "unassigned", label: "Unassigned" }, ...ownerOptions],
      contracts: [{ value: "", label: "Any contract" }, ...contractOptions],
      statuses: withCount(STATUS_FILTER_OPTIONS, statusCounts),
      types: TYPE_FILTER_OPTIONS,
      dueDates: withCount(DUE_FILTER_OPTIONS, dueCounts),
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

// Presentation-only vocabulary translation for task titles (§Surface
// Vocabulary). Internal/extraction wording is rewritten to the user-facing
// product terms before display; the underlying record is untouched.
function presentWorkTitle(value: string): string {
  return value
    .replace(/^(Approve|Review)\s+extracted\s+fields\s+for\b/i, "Review contract details for")
    .replace(/\bblocked\s+evidence\b/gi, "evidence request")
    .replace(/\bhold\s+blocker\b/gi, "hold")
    .replace(/\bblocker\b/gi, "hold")
    // "extraction" → "details" ("renewal extraction" → "renewal details") and
    // "exception" → "problem" (internal `exception` renders as Problem).
    .replace(/\bextraction\b/gi, "details")
    .replace(/\bexceptions\b/gi, "problems")
    .replace(/\bexception\b/gi, "problem")
    .replace(/\s+/g, " ")
    .trim();
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

function isWorkSortKey(value: string): value is WorkSortKey {
  return ["urgency", "due", "updated", "owner", "type"].includes(value);
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
  // "due_soon"/"none" and never surface in the Past due tab.
  const { dueState, dueInDays } = deriveDueMeta(dueAt, input.now);
  const blocker = normalizeToken(row.blocked_reason) || "—";
  const lastUpdateAt = row.last_state_change_at ?? row.updated_at ?? null;
  const title = presentWorkTitle(normalizeToken(row.title) || WORK_TYPE_LABELS[type]);
  const contractTitle = contract?.title || (contractId ? "Untitled contract" : "—");
  const counterparty = normalizeToken(contract?.counterparty) || null;
  const dueLabel = formatDateLabel(dueAt);
  const duePrimaryLabel = dueAt ? dueLabel : null;
  const dueRelativeLabel = formatDueRelative(dueInDays);
  const lastUpdateLabel = formatRelativeLabel(lastUpdateAt);
  const lastUpdateReadable = formatUpdatedReadable(lastUpdateAt);
  const nextActionNote = deriveNextActionNote({ blocker, ownerUserId, dueState, type });
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
    counterparty,
    contractHref,
    ownerUserId,
    ownerLabel,
    dueAt,
    dueLabel,
    dueState,
    dueInDays,
    duePrimaryLabel,
    dueRelativeLabel,
    blocker,
    nextActionNote,
    lastUpdateAt,
    lastUpdateLabel,
    lastUpdateReadable,
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
    primaryAction: derivePrimaryAction({ type, status, href }),
    actions: buildActionCapabilities({ type, status, sourceId, contractId, href, contractHref }),
  };
}

/** The complete mutation this row supports, if any. Shared by the primary
 *  action and the overflow-menu builder so they never disagree. */
function completeMutationFor(
  type: WorkTypeKey,
  status: string
): "complete_task" | "complete_obligation" | null {
  if (type === "contract_task" && ["open", "in_progress"].includes(status)) return "complete_task";
  if (type === "obligation" && ["open", "in_progress"].includes(status)) return "complete_obligation";
  return null;
}

/** Pick the one elevated row action. Verb varies by type/status so the queue
 *  reads "Approve renewal", "Resolve issue", "Attach evidence" rather than
 *  a uniform "Complete". Tasks that need input cannot be completed, so the next
 *  step is to review the dependency. Links reuse `href` (already routed by
 *  getV10WorkItemHref); only tasks/obligations carry a real complete mutation. */
function derivePrimaryAction(input: {
  type: WorkTypeKey;
  status: string;
  href: string;
}): WorkPrimaryAction {
  const mutation = completeMutationFor(input.type, input.status);
  if (input.status === "blocked") {
    return { verb: "review", label: WORK_PRIMARY_ACTION_LABELS.review, kind: "link", href: input.href };
  }
  switch (input.type) {
    case "approval":
      return { verb: "approve", label: WORK_PRIMARY_ACTION_LABELS.approve, kind: "link", href: input.href };
    case "exception":
      return { verb: "resolve", label: WORK_PRIMARY_ACTION_LABELS.resolve, kind: "link", href: input.href };
    case "evidence_request":
      return { verb: "attach", label: WORK_PRIMARY_ACTION_LABELS.attach, kind: "link", href: input.href };
    case "renewal_checkpoint":
      return { verb: "review", label: WORK_PRIMARY_ACTION_LABELS.review, kind: "link", href: input.href };
    case "unassigned_work":
      return { verb: "assign", label: WORK_PRIMARY_ACTION_LABELS.assign, kind: "link", href: input.href };
  }
  if (mutation) {
    return {
      verb: "complete",
      label: WORK_PRIMARY_ACTION_LABELS.complete,
      kind: "mutation",
      href: input.href,
      mutation,
    };
  }
  return { verb: "review", label: WORK_PRIMARY_ACTION_LABELS.review, kind: "link", href: input.href };
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
  const completeMutation = completeMutationFor(input.type, input.status);
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

function compareByDue(a: WorkItemRow, b: WorkItemRow) {
  if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;
  return (b.lastUpdateAt ?? "").localeCompare(a.lastUpdateAt ?? "");
}

function compareByUpdated(a: WorkItemRow, b: WorkItemRow) {
  return (b.lastUpdateAt ?? "").localeCompare(a.lastUpdateAt ?? "");
}

function compareByOwner(a: WorkItemRow, b: WorkItemRow) {
  const owner = a.ownerLabel.localeCompare(b.ownerLabel);
  return owner !== 0 ? owner : compareByDue(a, b);
}

function compareByType(a: WorkItemRow, b: WorkItemRow) {
  const type = a.typeLabel.localeCompare(b.typeLabel);
  return type !== 0 ? type : compareByDue(a, b);
}

function workComparator(sort: WorkSortKey): (a: WorkItemRow, b: WorkItemRow) => number {
  switch (sort) {
    case "due":
      return compareByDue;
    case "updated":
      return compareByUpdated;
    case "owner":
      return compareByOwner;
    case "type":
      return compareByType;
    default:
      return compareWorkRows;
  }
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
  // "open" is the baseline, non-urgent state and shows up on most rows; keep it
  // neutral so status color stays reserved for blocked/overdue/in-progress
  // (§10.2 status earns color). Only genuinely unknown statuses get accent.
  if (status === "open") return "empty";
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

// Readable "Updated 2 days ago" for the ledger column — replaces the terse
// "2D" so the recency is legible without decoding (§18.13 relative time as
// supporting context).
function formatUpdatedReadable(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `Updated ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

// Plain-language relative due descriptor. Absolute date carries the primary
// value; this is the supporting "Due in 2 days" / "Past due by 3 days" line so
// the ledger never leans on a compressed decorative pill (§18.13).
function formatDueRelative(dueInDays: number | null): string | null {
  if (dueInDays == null) return null;
  if (dueInDays < 0) {
    const n = Math.abs(dueInDays);
    return `Past due by ${n} ${n === 1 ? "day" : "days"}`;
  }
  if (dueInDays === 0) return "Due today";
  if (dueInDays === 1) return "Due tomorrow";
  return `Due in ${dueInDays} days`;
}

// The one second-line note under a task title. Derived strictly from real row
// signals — never filler. The dependency reason is the most useful when a task
// cannot proceed; otherwise a missing owner or a passed due date is the next
// step. When the title already says everything, return null (§6 anti-noise).
function deriveNextActionNote(input: {
  blocker: string;
  ownerUserId: string | null;
  dueState: string;
  type: WorkTypeKey;
}): string | null {
  if (input.blocker && input.blocker !== "—") return input.blocker;
  if (!input.ownerUserId && input.type !== "unassigned_work") {
    return "Assign an owner so reminders and follow-up can route.";
  }
  // Renewal review tasks turn a suggested/calculated date into trusted data —
  // name that consequence so the user knows why confirmation matters (§18.8).
  if (input.type === "renewal_checkpoint") {
    return "Confirm the date before reminders and reports rely on it.";
  }
  if (input.dueState === "overdue") return "Past due — resolve before it slips further.";
  return null;
}
