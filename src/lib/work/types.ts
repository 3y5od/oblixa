import type { WORK_ACTION_LABELS, WORK_TAB_LABELS, WORK_TYPE_LABELS } from "./spec-strings";

export type WorkTabKey = keyof typeof WORK_TAB_LABELS;
export type WorkTypeKey = keyof typeof WORK_TYPE_LABELS;
export type WorkActionKey = keyof typeof WORK_ACTION_LABELS;

export type WorkDueFilterKey = "" | "overdue" | "due_today" | "due_soon" | "no_due";
export type WorkStatusFilterKey = "" | "open" | "in_progress" | "blocked" | "waiting" | "done" | "canceled";

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
  contractId: string | null;
  contractTitle: string;
  contractHref: string | null;
  ownerUserId: string | null;
  ownerLabel: string;
  dueAt: string | null;
  dueLabel: string;
  dueState: string;
  /** Calendar days from now to due_at; negative = overdue, 0 = today, null = no due date. */
  dueInDays: number | null;
  blocker: string;
  lastUpdateAt: string | null;
  lastUpdateLabel: string;
  href: string;
  display: WorkRowDisplayGroups;
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
  rows: WorkItemRow[];
  totalVisibleRows: number;
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
};

export type WorkModelLoadInput = WorkModelSearchInput & {
  userId: string;
  role?: string | null;
  workspaceMode?: string | null;
};
