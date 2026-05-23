import type {
  EVIDENCE_ACTION_LABELS,
  EVIDENCE_SECTION_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "./spec-strings";

export type EvidenceSectionKey = keyof typeof EVIDENCE_SECTION_LABELS;
export type EvidenceStatusKey = keyof typeof EVIDENCE_STATUS_LABELS;
export type EvidenceActionKey = keyof typeof EVIDENCE_ACTION_LABELS;

export type EvidenceModelSearchInput = {
  section?: string | null;
  contract?: string | null;
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
  sections: EvidenceSectionSummary[];
  rows: EvidenceRow[];
  totalVisibleRows: number;
  create: EvidenceCreateModel;
  warnings: string[];
};
