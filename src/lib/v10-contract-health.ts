import {
  V10_CONTRACT_NEXT_ACTION_ORDER,
  V10_HEALTH_DEDUCTIONS,
  type V10ContractNextAction,
  type V10HealthBand,
  type V10HealthDeductionKey,
  type V10SourceObjectType,
} from "./v10-release-contract";

export type V10HealthDeduction = {
  key: V10HealthDeductionKey;
  points: number;
  sourceType?: string;
  sourceId?: string;
};

export type V10ContractHealthInput = {
  missingRequiredFieldCount?: number;
  missingCriticalDateCount?: number;
  overdueLinkedWorkCount?: number;
  openHighOrCriticalExceptionCount?: number;
  outstandingEvidenceCount?: number;
  outstandingEvidenceOverdueCount?: number;
  renewalNoticeDeadlineInside30Days?: boolean;
  renewalPostureTerminal?: boolean;
  ownerMissingOrStale?: boolean;
  failedOrPartialRetryableJobCount?: number;
  missingRecommendedFieldCount?: number;
};

export function getV10HealthBand(score: number): V10HealthBand {
  if (score >= 85) return "healthy";
  if (score >= 70) return "watch";
  if (score >= 60) return "at_risk";
  return "critical";
}

function deduction(key: V10HealthDeductionKey): V10HealthDeduction {
  const row = V10_HEALTH_DEDUCTIONS.find((value) => value.key === key);
  if (!row) throw new Error(`Unknown V10 health deduction: ${key}`);
  return { key, points: row.points };
}

export function calculateV10ContractHealth(input: V10ContractHealthInput): {
  score: number;
  band: V10HealthBand;
  deductions: V10HealthDeduction[];
} {
  const deductions: V10HealthDeduction[] = [];
  if ((input.missingRequiredFieldCount ?? 0) > 0) deductions.push(deduction("missing_required_activation_field"));
  if ((input.missingCriticalDateCount ?? 0) > 0) deductions.push(deduction("missing_or_unapproved_critical_date"));
  if ((input.overdueLinkedWorkCount ?? 0) > 0) deductions.push(deduction("overdue_linked_work"));
  if ((input.openHighOrCriticalExceptionCount ?? 0) > 0) deductions.push(deduction("open_high_or_critical_exception"));
  if ((input.outstandingEvidenceCount ?? 0) > 0 && (input.outstandingEvidenceOverdueCount ?? 0) === 0) {
    deductions.push(deduction("outstanding_evidence_not_overdue"));
  }
  if (input.renewalNoticeDeadlineInside30Days && !input.renewalPostureTerminal) {
    deductions.push(deduction("renewal_notice_deadline_inside_30_days"));
  }
  if (input.ownerMissingOrStale) deductions.push(deduction("missing_or_stale_owner"));
  if ((input.failedOrPartialRetryableJobCount ?? 0) > 0) deductions.push(deduction("failed_or_partial_retryable_job"));
  if ((input.missingRecommendedFieldCount ?? 0) > 0) deductions.push(deduction("missing_recommended_fields"));
  const score = Math.max(0, 100 - deductions.reduce((sum, item) => sum + item.points, 0));
  return { score, band: getV10HealthBand(score), deductions };
}

export type V10NextActionInput = {
  failedImportOrExtractionBlockingRecordCreation?: boolean;
  missingRequiredActivationField?: boolean;
  pendingRequiredFieldReview?: boolean;
  overdueApproval?: boolean;
  overdueObligation?: boolean;
  overdueEvidenceRequest?: boolean;
  openCriticalException?: boolean;
  renewalNoticeDeadlineInside30Days?: boolean;
  renewalDateInside90Days?: boolean;
  unassignedOwner?: boolean;
  missingRecommendedField?: boolean;
};

export type V10ContractNextActionDestination = {
  action: V10ContractNextAction;
  sourceObjectType: V10SourceObjectType;
  href: string;
  ctaLabel: string;
  recoveryState: "actionable" | "recoverable" | "complete";
};

export function getV10ContractNextAction(input: V10NextActionInput): V10ContractNextAction {
  const checks: Record<Exclude<V10ContractNextAction, "no_action_required">, boolean | undefined> = {
    failed_import_or_extraction_blocking_record_creation: input.failedImportOrExtractionBlockingRecordCreation,
    missing_required_activation_field: input.missingRequiredActivationField,
    pending_required_field_review: input.pendingRequiredFieldReview,
    overdue_approval: input.overdueApproval,
    overdue_obligation: input.overdueObligation,
    overdue_evidence_request: input.overdueEvidenceRequest,
    open_critical_exception: input.openCriticalException,
    renewal_notice_deadline_inside_30_days: input.renewalNoticeDeadlineInside30Days,
    renewal_date_inside_90_days: input.renewalDateInside90Days,
    unassigned_owner: input.unassignedOwner,
    missing_recommended_field: input.missingRecommendedField,
  };
  for (const action of V10_CONTRACT_NEXT_ACTION_ORDER) {
    if (action !== "no_action_required" && checks[action]) return action;
  }
  return "no_action_required";
}

const V10_CONTRACT_NEXT_ACTION_DESTINATIONS: Record<
  V10ContractNextAction,
  Omit<V10ContractNextActionDestination, "action" | "href">
> = {
  failed_import_or_extraction_blocking_record_creation: {
    sourceObjectType: "import_job",
    ctaLabel: "Review failed import",
    recoveryState: "recoverable",
  },
  missing_required_activation_field: {
    sourceObjectType: "field",
    ctaLabel: "Review required fields",
    recoveryState: "actionable",
  },
  pending_required_field_review: {
    sourceObjectType: "field",
    ctaLabel: "Continue field review",
    recoveryState: "actionable",
  },
  overdue_approval: {
    sourceObjectType: "approval",
    ctaLabel: "Open overdue approval",
    recoveryState: "actionable",
  },
  overdue_obligation: {
    sourceObjectType: "obligation",
    ctaLabel: "Open overdue obligation",
    recoveryState: "actionable",
  },
  overdue_evidence_request: {
    sourceObjectType: "evidence_request",
    ctaLabel: "Open evidence request",
    recoveryState: "actionable",
  },
  open_critical_exception: {
    sourceObjectType: "exception",
    ctaLabel: "Resolve critical exception",
    recoveryState: "actionable",
  },
  renewal_notice_deadline_inside_30_days: {
    sourceObjectType: "renewal_checkpoint",
    ctaLabel: "Open renewal notice task",
    recoveryState: "actionable",
  },
  renewal_date_inside_90_days: {
    sourceObjectType: "renewal_checkpoint",
    ctaLabel: "Review renewal posture",
    recoveryState: "actionable",
  },
  unassigned_owner: {
    sourceObjectType: "contract",
    ctaLabel: "Assign owner",
    recoveryState: "actionable",
  },
  missing_recommended_field: {
    sourceObjectType: "field",
    ctaLabel: "Review recommended fields",
    recoveryState: "actionable",
  },
  no_action_required: {
    sourceObjectType: "contract",
    ctaLabel: "Open contract record",
    recoveryState: "complete",
  },
};

function contractDestinationHref(contractId: string, action: V10ContractNextAction): string {
  const encoded = encodeURIComponent(contractId);
  if (action === "failed_import_or_extraction_blocking_record_creation") return "/settings/health#v10-jobs";
  if (action === "overdue_approval") return `/contracts/${encoded}?tab=overview#contract-approvals`;
  if (action === "overdue_obligation") return `/contracts/${encoded}?tab=overview#contract-obligations`;
  if (action === "overdue_evidence_request") return `/contracts/${encoded}?tab=overview#contract-evidence`;
  if (action === "open_critical_exception") return `/contracts/${encoded}?tab=overview#contract-exceptions`;
  if (action === "renewal_notice_deadline_inside_30_days" || action === "renewal_date_inside_90_days") {
    return `/contracts/${encoded}?tab=renewals`;
  }
  if (
    action === "missing_required_activation_field" ||
    action === "pending_required_field_review" ||
    action === "missing_recommended_field"
  ) {
    return `/contracts/${encoded}?tab=fields`;
  }
  return `/contracts/${encoded}`;
}

export function buildV10ContractNextActionDestination(
  contractId: string,
  action: V10ContractNextAction
): V10ContractNextActionDestination {
  const base = V10_CONTRACT_NEXT_ACTION_DESTINATIONS[action];
  return {
    action,
    ...base,
    href: contractDestinationHref(contractId, action),
  };
}
