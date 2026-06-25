import type { WORK_ACTION_LABELS, WORK_TAB_LABELS, WORK_TYPE_LABELS } from "./spec-strings";

export type WorkTabKey = keyof typeof WORK_TAB_LABELS;
export type WorkTypeKey = keyof typeof WORK_TYPE_LABELS;
export type WorkActionKey = keyof typeof WORK_ACTION_LABELS;

export type WorkDueFilterKey = "" | "overdue" | "due_today" | "due_soon" | "no_due";
export type WorkStatusFilterKey = "" | "open" | "in_progress" | "blocked" | "waiting" | "done" | "canceled";
export type WorkSortKey = "urgency" | "due" | "updated" | "owner" | "type";

export type WorkFilterState = {
  owner: string;
  dueDate: WorkDueFilterKey;
  contract: string;
  status: WorkStatusFilterKey;
  type: "" | WorkTypeKey;
};

export type WorkActionCapability = {
  key: WorkActionKey;
  label: string;
  kind: "mutation" | "link";
  href?: string;
  mutation?: "complete_task" | "complete_obligation";
};

export type WorkPrimaryVerb =
  | "complete"
  | "resolve"
  | "review"
  | "approve"
  | "attach"
  | "assign";

/** The single status/type-aware primary action surfaced on each row. The
 *  overflow menu still draws from `WorkItemRow.actions`; this only governs the
 *  one elevated control so its verb can vary (Approve / Resolve / Attach / …). */
export type WorkPrimaryAction = {
  verb: WorkPrimaryVerb;
  label: string;
  kind: "mutation" | "link";
  href: string;
  mutation?: "complete_task" | "complete_obligation";
};

export type WorkRowDisplayValue = {
  label: string;
  value: string;
  href?: string | null;
};

export type WorkRowDisplayGroups = {
  identity: {
    title: WorkRowDisplayValue;
    linkedContract: WorkRowDisplayValue;
  };
  ownership: {
    owner: WorkRowDisplayValue;
    dueDate: WorkRowDisplayValue;
    lastUpdate: WorkRowDisplayValue;
  };
  state: {
    status: WorkRowDisplayValue;
    type: WorkRowDisplayValue;
    blocker: WorkRowDisplayValue;
  };
};

export type WorkItemRow = {
  id: string;
  key: string;
  sourceId: string;
  sourceTable: string;
  type: WorkTypeKey;
  typeLabel: string;
  title: string;
  status: string;
  statusLabel: string;
  statusTone: "healthy" | "info" | "in_review" | "warning" | "blocked" | "overdue" | "critical" | "empty" | "disabled";
  /** Three-tier visual weight so the queue isn't blanketed in oxblood. Only the
   *  loudest tier — `critical` (cannot-proceed / genuinely blocked) — earns the
   *  danger rail, the filled oxblood badge, and the filled action. `overdue`
   *  reads serious but quieter (amber, no rail, quiet text status). `routine`
   *  is the calm baseline. Rebalances the surface so the one genuinely-blocked
   *  row dominates instead of every past-due row screaming red. */
  rowEmphasis: "critical" | "overdue" | "routine";
  /** Material treatment for the record's supporting block. Only the
   *  cannot-proceed tier gets the faintly danger-washed sheet; every other row
   *  (routine + overdue) reads as the same quiet record sheet, so the queue is
   *  not a field of colored panels. */
  recordTone: "critical" | "routine";
  /** True only for the loudest tier (rowEmphasis === "critical"). Kept as a
   *  convenience for the rail / filled-badge / filled-action checks. Past-due
   *  rows are NOT critical — they read serious but quiet (neutral record, ink
   *  status, amber confined to the due column). */
  isCritical: boolean;
  /** Resolved ink for the status label so routine conditions render as quiet
   *  colored text rather than a filled chip (matches the dashboard register). */
  statusInk: string;
  /** Tone of the second-line consequence note. Only the cannot-proceed tier's
   *  dependency reason wears the toned `danger` rule; past-due and routine notes
   *  read as quiet secondary text (`neutral`). `warning` is retained in the type
   *  for completeness but the model no longer emits it for the record body — the
   *  amber overdue cue lives in the due column. */
  nextActionTone: "danger" | "warning" | "neutral";
  contractId: string | null;
  contractTitle: string;
  /** The other party on the linked contract, surfaced as quiet metadata so two
   *  similarly-named contracts stay distinguishable in the ledger. */
  counterparty: string | null;
  contractHref: string | null;
  ownerUserId: string | null;
  ownerLabel: string;
  dueAt: string | null;
  dueLabel: string;
  dueState: string;
  /** Calendar days from now to due_at; negative = overdue, 0 = today, null = no due date. */
  dueInDays: number | null;
  /** Absolute due date for the ledger ("Jun 15, 2026"); null when no due date. */
  duePrimaryLabel: string | null;
  /** Relative due descriptor ("Due in 2 days" / "Past due by 3 days" / "Due
   *  today"); null when no due date. */
  dueRelativeLabel: string | null;
  blocker: string;
  /** The single second-line note under the task title: the dependency reason
   *  when the task cannot proceed, otherwise a state-derived next step (assign
   *  owner / past due). Null when the title is self-sufficient — never filler. */
  nextActionNote: string | null;
  lastUpdateAt: string | null;
  lastUpdateLabel: string;
  /** Readable "Updated 2 days ago" form for the ledger column. */
  lastUpdateReadable: string;
  href: string;
  display: WorkRowDisplayGroups;
  primaryAction: WorkPrimaryAction;
  actions: WorkActionCapability[];
};

export type WorkTabSummary = {
  key: WorkTabKey;
  label: string;
  count: number;
  href: string;
  active: boolean;
};

export type WorkOption = {
  value: string;
  label: string;
  /** Stable facet total (rows carrying this value across the full pre-filter
   *  set) — rendered as a trailing count in the filter dropdown. */
  count?: number;
};

export type WorkCreateModel = {
  open: boolean;
  contracts: WorkOption[];
  ownerOptions: WorkOption[];
  typeOptions: WorkOption[];
};

export type WorkPageModel = {
  title: string;
  eyebrow: string;
  primaryCta: string;
  activeTab: WorkTabKey;
  filters: WorkFilterState;
  tabs: WorkTabSummary[];
  /** The current page slice of the active tab's rows (already sorted). */
  rows: WorkItemRow[];
  totalVisibleRows: number;
  /** Distinct contracts represented across the active tab's full row set —
   *  drives the "Showing N tasks across M contracts" summary above the table. */
  visibleContractCount: number;
  /** Pagination for the active tab. `total` is the full tab row count; `rows`
   *  holds only the current page. */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  /** Active sort key + the available sort options for the control. */
  sort: WorkSortKey;
  sortOptions: WorkOption[];
  /** Queue-wide counts over the filtered set (pre-tab), for the header KPIs. */
  summary: {
    blocked: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
  };
  filterOptions: {
    owners: WorkOption[];
    contracts: WorkOption[];
    statuses: WorkOption[];
    types: WorkOption[];
    dueDates: WorkOption[];
  };
  create: WorkCreateModel;
  warnings: string[];
};

export type WorkModelSearchInput = {
  tab?: string | null;
  lens?: string | null;
  owner?: string | null;
  due?: string | null;
  contract?: string | null;
  status?: string | null;
  type?: string | null;
  create?: string | null;
  page?: string | null;
  sort?: string | null;
};

export type WorkModelLoadInput = WorkModelSearchInput & {
  userId: string;
  role?: string | null;
  workspaceMode?: string | null;
};
