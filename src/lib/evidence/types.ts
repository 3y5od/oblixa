import type {
  EVIDENCE_ACTION_LABELS,
  EVIDENCE_SECTION_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "./spec-strings";

export type EvidenceSectionKey = keyof typeof EVIDENCE_SECTION_LABELS;
export type EvidenceStatusKey = keyof typeof EVIDENCE_STATUS_LABELS;
export type EvidenceActionKey = keyof typeof EVIDENCE_ACTION_LABELS;

export type EvidenceDueFilterKey = "" | "overdue" | "due_today" | "due_soon" | "no_due";
export type EvidenceFileFilterKey = "" | "has_file" | "missing_file";
export type EvidenceStatusFilterKey = "" | EvidenceStatusKey;

export type EvidenceFilterState = {
  owner: string;
  status: EvidenceStatusFilterKey;
  due: EvidenceDueFilterKey;
  contract: string;
  obligation: string;
  file: EvidenceFileFilterKey;
};

export type EvidenceModelSearchInput = {
  section?: string | null;
  contract?: string | null;
  owner?: string | null;
  status?: string | null;
  due?: string | null;
  obligation?: string | null;
  file?: string | null;
  page?: string | null;
  create?: string | null;
};

export type EvidenceModelLoadInput = EvidenceModelSearchInput & {
  userId: string;
  role?: string | null;
  workspaceMode?: string | null;
};

export type EvidenceOption = {
  value: string;
  label: string;
  /** Total rows carrying this value across all (non-waived) requests — rendered
   *  as a trailing count in the filter dropdown. Computed pre-filter, so it
   *  stays stable as other filters are applied. */
  count?: number;
};

export type EvidenceActionCapability = {
  key: EvidenceActionKey;
  label: string;
  kind: "mutation" | "link";
  href?: string;
  mutation?: "upload_evidence" | "accept" | "reject" | "send_reminder";
  requirementId?: string;
  submissionId?: string | null;
};

export type EvidenceDisplayValue = {
  label: string;
  value: string;
  href?: string | null;
};

export type EvidenceRow = {
  id: string;
  requirementId: string;
  requestTitle: string;
  contractId: string | null;
  contractTitle: string;
  contractHref: string | null;
  linkedObligationId: string | null;
  linkedObligationTitle: string;
  linkedObligationHref: string | null;
  requestOwnerUserId: string | null;
  requestOwnerLabel: string;
  dueAt: string | null;
  dueLabel: string;
  /** Calendar days from now to due_at; negative = overdue, 0 = today, null = no due date. */
  dueInDays: number | null;
  /** Derived bucket used for risk tone + the due-state filter. */
  dueState: EvidenceDueFilterKey;
  lastUpdateAt: string | null;
  status: EvidenceStatusKey;
  statusLabel: string;
  statusTone: "healthy" | "info" | "in_review" | "warning" | "blocked" | "overdue" | "critical" | "empty" | "disabled";
  attachedFilesCount: number;
  attachedFilesLabel: string;
  latestSubmissionId: string | null;
  latestSubmissionStatus: string | null;
  href: string;
  display: {
    requestTitle: EvidenceDisplayValue;
    linkedContract: EvidenceDisplayValue;
    linkedObligation: EvidenceDisplayValue;
    requestOwner: EvidenceDisplayValue;
    dueDate: EvidenceDisplayValue;
    lastUpdate: EvidenceDisplayValue;
    status: EvidenceDisplayValue;
    attachedFiles: EvidenceDisplayValue;
  };
  actions: EvidenceActionCapability[];
};

export type EvidenceSectionSummary = {
  key: EvidenceSectionKey;
  label: string;
  count: number;
  href: string;
  active: boolean;
};

export type EvidenceCreateModel = {
  open: boolean;
  selectedContractId: string;
  contracts: EvidenceOption[];
  obligations: EvidenceOption[];
};

export type EvidencePageModel = {
  title: string;
  eyebrow: string;
  lead: string;
  primaryCta: string;
  activeSection: EvidenceSectionKey;
  selectedContractId: string;
  filters: EvidenceFilterState;
  hasActiveFilters: boolean;
  filterOptions: {
    owners: EvidenceOption[];
    statuses: EvidenceOption[];
    contracts: EvidenceOption[];
    obligations: EvidenceOption[];
  };
  /** Cross-cutting counts (within active filters) that the status tabs don't
   *  surface — power the header meta strip and the quick-filter chips. */
  summary: {
    dueSoon: number;
    missingFile: number;
  };
  sections: EvidenceSectionSummary[];
  /** The current page's rows for the active section. */
  rows: EvidenceRow[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalPages: number;
    /** Rows in the active section within filters, before paging. */
    totalInSection: number;
  };
  /** Rows visible across all sections within the active filters. */
  totalVisibleRows: number;
  /** Rows before any filter is applied — distinguishes an empty workspace
   *  from a filtered-empty result. */
  totalUnfilteredRows: number;
  create: EvidenceCreateModel;
  warnings: string[];
};
