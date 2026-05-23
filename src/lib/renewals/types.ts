import type {
  RENEWAL_ACTION_LABELS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_WINDOW_LABELS,
} from "./spec-strings";

export type RenewalWindowKey = keyof typeof RENEWAL_WINDOW_LABELS;
export type RenewalStatus = keyof typeof RENEWAL_STATUS_LABELS;
export type RenewalActionKey = keyof typeof RENEWAL_ACTION_LABELS;

export type RenewalFilterState = {
  owner: string;
  counterparty: string;
  status: "" | RenewalStatus;
};

export type RenewalActionCapability = {
  key: RenewalActionKey;
  label: string;
  kind: "mutation" | "link";
  href?: string;
  mutation?: "complete_checkpoint" | "reopen_checkpoint";
  checkpointId?: string | null;
};

export type RenewalOption = {
  value: string;
  label: string;
};

export type RenewalWindowSummary = {
  key: RenewalWindowKey;
  label: string;
  count: number;
  href: string;
  active: boolean;
};

export type RenewalRow = {
  id: string;
  title: string;
  href: string;
  counterparty: string;
  ownerUserId: string | null;
  ownerLabel: string;
  contractStatus: string;
  renewalDate: string | null;
  renewalDateLabel: string;
  noticeDate: string | null;
  noticeDateLabel: string;
  daysUntilRenewal: number | null;
  daysUntilNotice: number | null;
  status: RenewalStatus;
  statusLabel: string;
  statusTone: "healthy" | "info" | "in_review" | "warning" | "blocked" | "overdue" | "critical" | "empty" | "disabled";
  nextActionLabel: string;
  nextActionHref: string;
  checkpointId: string | null;
  checkpointStatus: string | null;
  lastUpdateAt: string | null;
  actions: RenewalActionCapability[];
};

export type RenewalCreateModel = {
  open: boolean;
  contracts: RenewalOption[];
  ownerOptions: RenewalOption[];
  selectedContract: string;
};

export type RenewalsPageModel = {
  title: string;
  eyebrow: string;
  lead: string;
  primaryCta: string;
  activeWindow: RenewalWindowKey;
  filters: RenewalFilterState;
  windows: RenewalWindowSummary[];
  rows: RenewalRow[];
  totalVisibleRows: number;
  summary: {
    visible: number;
    needsOwner: number;
    needsReview: number;
    noticeWindowOpen: number;
    inProgress: number;
  };
  filterOptions: {
    owners: RenewalOption[];
    counterparties: RenewalOption[];
    statuses: RenewalOption[];
  };
  create: RenewalCreateModel;
  exportHref: string;
  warnings: string[];
};

export type RenewalsModelSearchInput = {
  window?: string | null;
  horizon?: string | null;
  owner?: string | null;
  counterparty?: string | null;
  status?: string | null;
  create?: string | null;
  contract?: string | null;
};

export type RenewalsModelLoadInput = RenewalsModelSearchInput & {
  userId: string;
  role?: string | null;
  workspaceMode?: string | null;
};
