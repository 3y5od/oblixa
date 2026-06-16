import type {
  RENEWAL_ACTION_LABELS,
  RENEWAL_DATE_REVIEW_LABELS,
  RENEWAL_SORT_LABELS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_WINDOW_LABELS,
} from "./spec-strings";

export type RenewalWindowKey = keyof typeof RENEWAL_WINDOW_LABELS;
export type RenewalStatus = keyof typeof RENEWAL_STATUS_LABELS;
export type RenewalActionKey = keyof typeof RENEWAL_ACTION_LABELS;
export type RenewalSortKey = keyof typeof RENEWAL_SORT_LABELS;

/** Urgency band a row falls into under the default ("Most urgent") sort, used to
 *  render §54 section headers. Computed in the model so the banding stays
 *  testable and consistent with the row order. */
export type RenewalGroupKey = "notice_30" | "renewal_window" | "unconfirmed" | "later";

/** Tone for the operational consequence line — string-identical to the UI
 *  `StatTone` union, declared locally so lib types never depend on a component. */
export type RenewalConsequenceTone = "neutral" | "success" | "warning" | "danger";

/**
 * Provenance of a renewal/notice date as shown on the row:
 * - `reviewed`  — a human-approved extracted value is displayed.
 * - `suggested` — a value exists but has not been approved yet.
 * - `computed`  — derived (e.g. renewal date minus the notice window).
 * - `missing`   — no value to show.
 */
export type RenewalDateReviewState = keyof typeof RENEWAL_DATE_REVIEW_LABELS;

export type RenewalFilterState = {
  owner: string;
  counterparty: string;
  status: "" | RenewalStatus;
  review: "" | RenewalDateReviewState;
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
  /** Stable facet total (rows carrying this value across the full pre-filter
   *  set) — rendered as a trailing count in the filter dropdown. */
  count?: number;
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
  renewalDateReview: RenewalDateReviewState;
  noticeDate: string | null;
  noticeDateLabel: string;
  noticeDateReview: RenewalDateReviewState;
  /** True when the notice date was derived from the notice window rather than extracted directly. */
  noticeDateIsComputed: boolean;
  /** Notice-window length in days when known — drives the §18 calculated-date
   *  basis ("Calculated from the renewal date and N-day notice window"). */
  noticeWindowDays: number | null;
  daysUntilRenewal: number | null;
  daysUntilNotice: number | null;
  status: RenewalStatus;
  statusLabel: string;
  statusTone: "healthy" | "info" | "in_review" | "warning" | "blocked" | "overdue" | "critical" | "empty" | "disabled";
  /** §14/§20/§21/§27/§28 — plain-language operational consequence shown beneath
   *  the contract name. */
  consequence: { label: string; tone: RenewalConsequenceTone };
  /** §54 — urgency band for default-sort section headers. */
  group: RenewalGroupKey;
  /** §31/§55 — whether the row is inside the selected window and therefore part
   *  of the Upcoming renewals report for that window. */
  reportIncluded: boolean;
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
  activeSort: RenewalSortKey;
  /** True when the default urgency sort is active, so the page renders §54
   *  section headers; any explicit sort flattens the list. */
  grouped: boolean;
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
    /** Whether the workspace has any contracts at all — distinguishes the
     *  "no contracts yet" empty state from "no dates in this window" (§42). */
    hasAnyContracts: boolean;
    /** Contracts carrying neither a renewal nor a notice date; they never enter
     *  a window, so they are surfaced via a dedicated affordance (§45). */
    missingDates: number;
  };
  filterOptions: {
    owners: RenewalOption[];
    counterparties: RenewalOption[];
    statuses: RenewalOption[];
    reviewStates: RenewalOption[];
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
  review?: string | null;
  sort?: string | null;
  create?: string | null;
  contract?: string | null;
};

export type RenewalsModelLoadInput = RenewalsModelSearchInput & {
  userId: string;
  role?: string | null;
  workspaceMode?: string | null;
};
