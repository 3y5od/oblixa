import config from "../../config/operational-data-quality-invariants.json";

export type OperationalDataQualityConfig = typeof config;
export type ContractLifecycleStatus = "draft" | "pending_review" | "active" | "expired" | "terminated";
export type ObligationStatus = "open" | "in_progress" | "done" | "waived";
export type EvidenceStatus = "requested" | "submitted" | "approved" | "rejected" | "expired";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "canceled";
export type ExceptionStatus = "open" | "mitigating" | "resolved" | "reopened";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "canceled";
export type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "unmanaged";
export type WorkspaceMode = "core" | "advanced" | "enterprise";
export type TeamRole = "admin" | "editor" | "viewer" | "ops_manager" | "legal_reviewer" | "finance_reviewer" | "manager";

export type DomainInvariantSeverity = "P0" | "P1" | "P2";

export type DomainInvariantViolation = {
  invariantId: string;
  severity: DomainInvariantSeverity;
  entityType: string;
  entityId: string;
  reason: string;
  remediationHint: string;
};

export type DomainContractRecord = {
  id: string;
  organizationId: string;
  title: string;
  ownerId: string | null;
  createdBy: string | null;
  status: ContractLifecycleStatus | string;
  effectiveDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  noticeDeadline: string | null;
  counterparty: string | null;
  annualValue: number | null;
  currency: string | null;
  billingStatus: BillingStatus | string;
  workspaceMode: WorkspaceMode | string;
  stripeSubscriptionId?: string | null;
  reportRunOrganizationId?: string | null;
  updatedAt?: string | null;
};

export type DomainObligationRecord = {
  id: string;
  contractId: string;
  organizationId: string;
  status: ObligationStatus | string;
  ownerId: string | null;
  evidenceRequired: boolean;
  evidenceRequestIds: readonly string[];
  dueDate: string | null;
  completedAt: string | null;
};

export type DomainEvidenceRequirementRecord = {
  id: string;
  contractId: string;
  organizationId: string;
  status: EvidenceStatus | string;
  requesterUserId: string | null;
  reviewerUserId: string | null;
  submissionCount: number;
  dueDate: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type DomainApprovalRecord = {
  id: string;
  contractId: string;
  organizationId: string;
  status: ApprovalStatus | string;
  approverUserId: string | null;
  decidedAt: string | null;
};

export type DomainExceptionRecord = {
  id: string;
  contractId: string;
  organizationId: string;
  status: ExceptionStatus | string;
  severity: "low" | "medium" | "high" | "critical" | string;
  ownerId: string | null;
  resolutionAction: string | null;
  resolvedAt: string | null;
  reopenedAt: string | null;
};

export type DomainTaskRecord = {
  id: string;
  contractId: string;
  organizationId: string;
  status: TaskStatus | string;
  assigneeId: string | null;
  parentTaskId: string | null;
  blockedByTaskId: string | null;
  blockedReason: string | null;
  completedAt: string | null;
};

export type DomainReportRecord = {
  id: string;
  contractId: string;
  organizationId: string;
  reportRunOrganizationId: string;
};

export type DomainTeamMembershipRecord = {
  id: string;
  organizationId: string;
  userId: string;
  teamKey: string;
  role: TeamRole | string;
};

export type OperationalDomainRecord = {
  contract: DomainContractRecord;
  obligations?: readonly DomainObligationRecord[];
  evidenceRequirements?: readonly DomainEvidenceRequirementRecord[];
  approvals?: readonly DomainApprovalRecord[];
  approvalQuorum?: number;
  exceptions?: readonly DomainExceptionRecord[];
  tasks?: readonly DomainTaskRecord[];
  reports?: readonly DomainReportRecord[];
  teamMemberships?: readonly DomainTeamMembershipRecord[];
};

export type DataQualityEntityRecord = Record<string, string | number | boolean | null | undefined>;

export type DataQualitySnapshot = {
  generatedAt: string;
  contracts: readonly DataQualityEntityRecord[];
  tasks?: readonly DataQualityEntityRecord[];
  evidenceRequirements?: readonly DataQualityEntityRecord[];
  importJobs?: readonly DataQualityEntityRecord[];
  readModels?: readonly DataQualityEntityRecord[];
};

export type DataQualityIssue = {
  check: string;
  entityType: string;
  entityId: string;
  severity: DomainInvariantSeverity;
  reason: string;
};

export type DataQualityReport = {
  generatedAt: string;
  issueCount: number;
  issues: DataQualityIssue[];
  coverage: readonly string[];
};

export type ImportSourceRow = {
  rowId: string;
  fileHash: string | null;
  retryOfRowId?: string | null;
  title: string | null;
  counterparty: string | null;
  ownerEmail: string | null;
  effectiveDate: string | null;
  endDate: string | null;
  encodingSample?: string | null;
};

export type NormalizedImportRow = {
  rowId: string;
  fileHash: string | null;
  retryOfRowId: string | null;
  title: string;
  canonicalCounterparty: string;
  ownerEmail: string | null;
  effectiveDate: string | null;
  endDate: string | null;
  contractKey: string;
  valid: boolean;
  errors: string[];
};

export type ImportReconciliationReport = {
  normalizedRows: NormalizedImportRow[];
  duplicateFileHashes: string[];
  duplicateContractKeys: string[];
  inconsistentCounterpartyNames: string[];
  partialRetryRowIds: string[];
  issueCount: number;
};

export type ReadModelSourceRow = {
  sourceTable: string;
  sourceId: string;
  contractId: string | null;
  updatedAt: string;
  version: number;
};

export type ReadModelRow = {
  modelKey: string;
  sourceTable: string;
  sourceId: string;
  contractId: string | null;
  computedAt: string;
  version: number;
  lineageId: string | null;
  payloadHash: string;
};

export type ReadModelSafetyReport = {
  ok: boolean;
  issues: Array<{ check: string; sourceId: string; reason: string }>;
  expectedOutputKeys: string[];
};

export type CacheInvalidationInput = {
  cacheKey: string;
  cacheVersion: number;
  sourceVersion: number;
  sourceUpdatedAt: string;
  cacheGeneratedAt: string;
  sensitive: boolean;
  fallbackAvailable: boolean;
};

export type CacheInvalidationDecision = {
  invalidate: boolean;
  bypassCache: boolean;
  fallbackRead: boolean;
  reasons: string[];
};

const CONTRACT_TRANSITIONS: Record<ContractLifecycleStatus, readonly ContractLifecycleStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["active"],
  active: ["expired", "terminated"],
  expired: ["active"],
  terminated: ["active"],
};

const CONTRACT_STATUSES = new Set<ContractLifecycleStatus>(["draft", "pending_review", "active", "expired", "terminated"]);
const OBLIGATION_STATUSES = new Set<ObligationStatus>(["open", "in_progress", "done", "waived"]);
const EVIDENCE_STATUSES = new Set<EvidenceStatus>(["requested", "submitted", "approved", "rejected", "expired"]);
const APPROVAL_STATUSES = new Set<ApprovalStatus>(["pending", "approved", "rejected", "canceled"]);
const EXCEPTION_STATUSES = new Set<ExceptionStatus>(["open", "mitigating", "resolved", "reopened"]);
const TASK_STATUSES = new Set<TaskStatus>(["open", "in_progress", "blocked", "done", "canceled"]);
const BILLING_STATUSES = new Set<BillingStatus>(["trialing", "active", "past_due", "canceled", "unmanaged"]);
const WORKSPACE_MODES = new Set<WorkspaceMode>(["core", "advanced", "enterprise"]);
const TEAM_ROLES = new Set<TeamRole>([
  "admin",
  "editor",
  "viewer",
  "ops_manager",
  "legal_reviewer",
  "finance_reviewer",
  "manager",
]);

export const OPERATIONAL_DATA_QUALITY_CONFIG = config as OperationalDataQualityConfig;
export const OPERATIONAL_DOMAIN_INVARIANTS = OPERATIONAL_DATA_QUALITY_CONFIG.domainInvariants;
export const OPERATIONAL_DATA_QUALITY_REPORT_CHECKS = OPERATIONAL_DATA_QUALITY_CONFIG.dataQualityReportChecks;
export const OPERATIONAL_IMPORT_RECONCILIATION_CASES = OPERATIONAL_DATA_QUALITY_CONFIG.importReconciliationCases;
export const OPERATIONAL_READ_MODEL_SAFETY_CASES = OPERATIONAL_DATA_QUALITY_CONFIG.readModelSafetyCases;

function dateOnlyToUtcMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) return null;
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === day ? date.getTime() : null;
}

function isoToMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushViolation(
  violations: DomainInvariantViolation[],
  input: Omit<DomainInvariantViolation, "remediationHint"> & { remediationHint?: string },
): void {
  const invariant = OPERATIONAL_DOMAIN_INVARIANTS.find((row) => row.id === input.invariantId);
  violations.push({
    ...input,
    remediationHint: input.remediationHint ?? invariant?.remediationHint ?? "Repair the source row before retrying the workflow.",
  });
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function canonicalizeCounterparty(value: string | null | undefined): string {
  return normalizeWhitespace(value ?? "").toLocaleLowerCase("en-US");
}

export function canTransitionContractStatus(from: string, to: string): boolean {
  if (!CONTRACT_STATUSES.has(from as ContractLifecycleStatus)) return false;
  if (!CONTRACT_STATUSES.has(to as ContractLifecycleStatus)) return false;
  return CONTRACT_TRANSITIONS[from as ContractLifecycleStatus].includes(to as ContractLifecycleStatus);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function fiscalYearForDate(date: Date, fiscalYearStartMonth = 1): number {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return month >= fiscalYearStartMonth ? year : year - 1;
}

export function parseCurrencyAmount(input: string | number | null | undefined, defaultCurrency = "USD") {
  const raw = typeof input === "number" ? String(input) : String(input ?? "").trim();
  const currency = (raw.match(/\b[A-Z]{3}\b/u)?.[0] ?? defaultCurrency).toUpperCase();
  const numeric = raw.replace(/\b[A-Z]{3}\b/gu, "").replace(/[$,\s]/gu, "");
  if (!/^-?\d+(?:\.\d{1,2})?$/u.test(numeric)) {
    return { ok: false as const, reason: "invalid_currency_amount", currency };
  }
  const major = Number(numeric);
  const minorUnits = Math.round(major * 100);
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0 || minorUnits > 99_999_999_999_999) {
    return { ok: false as const, reason: "currency_amount_out_of_bounds", currency };
  }
  if (!/^[A-Z]{3}$/u.test(currency)) {
    return { ok: false as const, reason: "invalid_currency_code", currency };
  }
  return { ok: true as const, minorUnits, currency };
}

export function escapeCsvCell(value: string): string {
  const formulaSafe = /^[=+\-@]/u.test(value) ? `'${value}` : value;
  return /[",\n\r]/u.test(formulaSafe) ? `"${formulaSafe.replace(/"/gu, "\"\"")}"` : formulaSafe;
}

export function normalizeSearchQuery(value: string): string {
  return normalizeWhitespace(value).slice(0, 200);
}

export function paginateStable<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const safePageSize = Math.max(1, Math.min(250, Math.trunc(pageSize) || 1));
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const start = (safePage - 1) * safePageSize;
  return items.slice(start, start + safePageSize);
}

export function sortRecordsStable<T extends Record<string, unknown>>(items: readonly T[], key: keyof T): T[] {
  return [...items].sort((a, b) => {
    const left = String(a[key] ?? "");
    const right = String(b[key] ?? "");
    const cmp = left.localeCompare(right);
    if (cmp !== 0) return cmp;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

export function dedupeByKey<T>(items: readonly T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = keyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

export function serializeUrlState(state: Record<string, string | number | boolean | readonly string[] | null | undefined>): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(state).sort()) {
    const value = state[key];
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of [...value].map(String).sort()) params.append(key, item);
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export function validateDomainRecord(record: OperationalDomainRecord): DomainInvariantViolation[] {
  const violations: DomainInvariantViolation[] = [];
  const contract = record.contract;
  const contractId = contract.id || "(missing)";
  const effectiveMs = dateOnlyToUtcMs(contract.effectiveDate);
  const endMs = dateOnlyToUtcMs(contract.endDate);
  const renewalMs = dateOnlyToUtcMs(contract.renewalDate);
  const noticeMs = dateOnlyToUtcMs(contract.noticeDeadline);

  if (!CONTRACT_STATUSES.has(contract.status as ContractLifecycleStatus)) {
    pushViolation(violations, {
      invariantId: "contract-status-transitions",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "unknown_contract_status",
    });
  }
  if ((contract.status === "active" || contract.status === "pending_review") && !contract.ownerId) {
    pushViolation(violations, {
      invariantId: "contract-ownership",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "owner_required_for_operational_contract",
    });
  }
  if (contract.status === "active" && (!contract.effectiveDate || !contract.endDate)) {
    pushViolation(violations, {
      invariantId: "renewal-date-ordering",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "active_contract_requires_key_dates",
    });
  }
  if ((contract.effectiveDate && effectiveMs == null) || (contract.endDate && endMs == null) || (contract.renewalDate && renewalMs == null)) {
    pushViolation(violations, {
      invariantId: "renewal-date-ordering",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "invalid_contract_date",
    });
  }
  if (contract.noticeDeadline && noticeMs == null) {
    pushViolation(violations, {
      invariantId: "notice-window-ordering",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "invalid_notice_deadline",
    });
  }
  if (effectiveMs != null && endMs != null && effectiveMs > endMs) {
    pushViolation(violations, {
      invariantId: "renewal-date-ordering",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "effective_date_after_end_date",
    });
  }
  if (renewalMs != null && endMs != null && renewalMs > endMs) {
    pushViolation(violations, {
      invariantId: "renewal-date-ordering",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "renewal_after_end_date",
    });
  }
  if (noticeMs != null && renewalMs != null && noticeMs > renewalMs) {
    pushViolation(violations, {
      invariantId: "notice-window-ordering",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "notice_deadline_after_renewal",
    });
  }
  if (noticeMs != null && endMs != null && noticeMs > endMs) {
    pushViolation(violations, {
      invariantId: "notice-window-ordering",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "notice_deadline_after_end",
    });
  }
  if (!canonicalizeCounterparty(contract.counterparty) || /[\u0000-\u001f]/u.test(contract.counterparty ?? "")) {
    pushViolation(violations, {
      invariantId: "counterparty-data",
      severity: "P1",
      entityType: "contract",
      entityId: contractId,
      reason: "invalid_counterparty",
    });
  }
  const parsedMoney = contract.annualValue == null ? { ok: true as const } : parseCurrencyAmount(contract.annualValue, contract.currency ?? "USD");
  if (!parsedMoney.ok || (contract.annualValue != null && !/^[A-Z]{3}$/u.test(contract.currency ?? ""))) {
    pushViolation(violations, {
      invariantId: "financial-fields",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "invalid_financial_field",
    });
  }
  if (!BILLING_STATUSES.has(contract.billingStatus as BillingStatus)) {
    pushViolation(violations, {
      invariantId: "billing-status",
      severity: "P1",
      entityType: "contract",
      entityId: contractId,
      reason: "unknown_billing_status",
    });
  }
  if (contract.billingStatus === "active" && contract.workspaceMode !== "core" && !contract.stripeSubscriptionId) {
    pushViolation(violations, {
      invariantId: "billing-status",
      severity: "P1",
      entityType: "contract",
      entityId: contractId,
      reason: "paid_workspace_missing_subscription",
    });
  }
  if (!WORKSPACE_MODES.has(contract.workspaceMode as WorkspaceMode)) {
    pushViolation(violations, {
      invariantId: "workspace-mode",
      severity: "P1",
      entityType: "contract",
      entityId: contractId,
      reason: "unknown_workspace_mode",
    });
  }

  for (const obligation of record.obligations ?? []) {
    if (!OBLIGATION_STATUSES.has(obligation.status as ObligationStatus)) {
      pushViolation(violations, {
        invariantId: "obligation-lifecycle",
        severity: "P1",
        entityType: "obligation",
        entityId: obligation.id,
        reason: "unknown_obligation_status",
      });
    }
    if (obligation.status === "done" && !obligation.completedAt) {
      pushViolation(violations, {
        invariantId: "obligation-lifecycle",
        severity: "P1",
        entityType: "obligation",
        entityId: obligation.id,
        reason: "done_obligation_missing_completed_at",
      });
    }
    if ((obligation.status === "open" || obligation.status === "in_progress") && obligation.completedAt) {
      pushViolation(violations, {
        invariantId: "obligation-lifecycle",
        severity: "P1",
        entityType: "obligation",
        entityId: obligation.id,
        reason: "active_obligation_has_terminal_timestamp",
      });
    }
    if (obligation.evidenceRequired && obligation.evidenceRequestIds.length === 0) {
      pushViolation(violations, {
        invariantId: "obligation-lifecycle",
        severity: "P1",
        entityType: "obligation",
        entityId: obligation.id,
        reason: "evidence_required_without_request",
      });
    }
  }

  for (const evidence of record.evidenceRequirements ?? []) {
    if (!EVIDENCE_STATUSES.has(evidence.status as EvidenceStatus)) {
      pushViolation(violations, {
        invariantId: "evidence-requirements",
        severity: "P1",
        entityType: "evidence_requirement",
        entityId: evidence.id,
        reason: "unknown_evidence_status",
      });
    }
    if ((evidence.status === "approved" || evidence.status === "rejected") && (!evidence.reviewerUserId || !evidence.reviewedAt)) {
      pushViolation(violations, {
        invariantId: "evidence-requirements",
        severity: "P1",
        entityType: "evidence_requirement",
        entityId: evidence.id,
        reason: "reviewed_evidence_missing_reviewer_or_timestamp",
      });
    }
    if ((evidence.status === "submitted" || evidence.status === "approved") && evidence.submissionCount < 1) {
      pushViolation(violations, {
        invariantId: "evidence-requirements",
        severity: "P1",
        entityType: "evidence_requirement",
        entityId: evidence.id,
        reason: "submitted_evidence_missing_submission",
      });
    }
    if (evidence.status === "rejected" && !evidence.rejectionReason) {
      pushViolation(violations, {
        invariantId: "evidence-requirements",
        severity: "P1",
        entityType: "evidence_requirement",
        entityId: evidence.id,
        reason: "rejected_evidence_missing_reason",
      });
    }
  }

  const approvedApproverIds = new Set<string>();
  for (const approval of record.approvals ?? []) {
    if (!APPROVAL_STATUSES.has(approval.status as ApprovalStatus)) {
      pushViolation(violations, {
        invariantId: "approval-quorum",
        severity: "P0",
        entityType: "approval",
        entityId: approval.id,
        reason: "unknown_approval_status",
      });
    }
    if ((approval.status === "approved" || approval.status === "rejected") && (!approval.approverUserId || !approval.decidedAt)) {
      pushViolation(violations, {
        invariantId: "approval-quorum",
        severity: "P0",
        entityType: "approval",
        entityId: approval.id,
        reason: "terminal_approval_missing_decision",
      });
    }
    if (approval.status === "pending" && approval.decidedAt) {
      pushViolation(violations, {
        invariantId: "approval-quorum",
        severity: "P0",
        entityType: "approval",
        entityId: approval.id,
        reason: "pending_approval_has_decision_timestamp",
      });
    }
    if (approval.status === "approved" && approval.approverUserId) approvedApproverIds.add(approval.approverUserId);
  }
  if ((record.approvalQuorum ?? 0) > approvedApproverIds.size) {
    pushViolation(violations, {
      invariantId: "approval-quorum",
      severity: "P0",
      entityType: "contract",
      entityId: contractId,
      reason: "approval_quorum_not_met",
    });
  }

  for (const exception of record.exceptions ?? []) {
    if (!EXCEPTION_STATUSES.has(exception.status as ExceptionStatus)) {
      pushViolation(violations, {
        invariantId: "exception-state",
        severity: "P1",
        entityType: "exception",
        entityId: exception.id,
        reason: "unknown_exception_status",
      });
    }
    if (exception.status === "resolved" && (!exception.resolutionAction || !exception.resolvedAt)) {
      pushViolation(violations, {
        invariantId: "exception-state",
        severity: "P1",
        entityType: "exception",
        entityId: exception.id,
        reason: "resolved_exception_missing_resolution",
      });
    }
    if ((exception.status === "open" || exception.status === "mitigating") && exception.resolvedAt) {
      pushViolation(violations, {
        invariantId: "exception-state",
        severity: "P1",
        entityType: "exception",
        entityId: exception.id,
        reason: "active_exception_has_resolved_timestamp",
      });
    }
    if (exception.status === "reopened" && !exception.reopenedAt) {
      pushViolation(violations, {
        invariantId: "exception-state",
        severity: "P1",
        entityType: "exception",
        entityId: exception.id,
        reason: "reopened_exception_missing_reopened_at",
      });
    }
  }

  for (const task of record.tasks ?? []) {
    if (!TASK_STATUSES.has(task.status as TaskStatus)) {
      pushViolation(violations, {
        invariantId: "task-dependencies",
        severity: "P1",
        entityType: "task",
        entityId: task.id,
        reason: "unknown_task_status",
      });
    }
    if (task.parentTaskId === task.id || task.blockedByTaskId === task.id) {
      pushViolation(violations, {
        invariantId: "task-dependencies",
        severity: "P1",
        entityType: "task",
        entityId: task.id,
        reason: "self_referential_task_dependency",
      });
    }
    if (task.status === "blocked" && !task.blockedByTaskId && !task.blockedReason) {
      pushViolation(violations, {
        invariantId: "task-dependencies",
        severity: "P1",
        entityType: "task",
        entityId: task.id,
        reason: "blocked_task_missing_blocker",
      });
    }
    if (task.status === "done" && !task.completedAt) {
      pushViolation(violations, {
        invariantId: "task-dependencies",
        severity: "P1",
        entityType: "task",
        entityId: task.id,
        reason: "done_task_missing_completed_at",
      });
    }
  }

  for (const report of record.reports ?? []) {
    if (report.organizationId !== contract.organizationId || report.reportRunOrganizationId !== contract.organizationId) {
      pushViolation(violations, {
        invariantId: "report-scope",
        severity: "P1",
        entityType: "report",
        entityId: report.id,
        reason: "report_organization_scope_mismatch",
      });
    }
    if (report.contractId !== contract.id) {
      pushViolation(violations, {
        invariantId: "report-scope",
        severity: "P1",
        entityType: "report",
        entityId: report.id,
        reason: "report_contract_scope_mismatch",
      });
    }
  }

  const membershipKeys = new Set<string>();
  for (const membership of record.teamMemberships ?? []) {
    const key = `${membership.organizationId}:${membership.userId}:${membership.teamKey}`;
    if (membership.organizationId !== contract.organizationId) {
      pushViolation(violations, {
        invariantId: "team-membership",
        severity: "P0",
        entityType: "team_membership",
        entityId: membership.id,
        reason: "membership_organization_mismatch",
      });
    }
    if (membershipKeys.has(key)) {
      pushViolation(violations, {
        invariantId: "team-membership",
        severity: "P0",
        entityType: "team_membership",
        entityId: membership.id,
        reason: "duplicate_team_membership",
      });
    }
    membershipKeys.add(key);
    if (!TEAM_ROLES.has(membership.role as TeamRole)) {
      pushViolation(violations, {
        invariantId: "team-membership",
        severity: "P0",
        entityType: "team_membership",
        entityId: membership.id,
        reason: "unknown_team_role",
      });
    }
  }

  return violations.sort((a, b) => `${a.invariantId}:${a.entityId}:${a.reason}`.localeCompare(`${b.invariantId}:${b.entityId}:${b.reason}`));
}

function stringField(row: DataQualityEntityRecord, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function addIssue(issues: DataQualityIssue[], issue: DataQualityIssue): void {
  issues.push(issue);
}

export function buildDataQualityReport(snapshot: DataQualitySnapshot): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  const contracts = [...snapshot.contracts].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
  const contractIds = new Set(contracts.map((row) => stringField(row, "id")).filter((id): id is string => Boolean(id)));
  const counterpartyGroups = new Map<string, string[]>();

  for (const contract of contracts) {
    const id = stringField(contract, "id") ?? "(missing)";
    const status = stringField(contract, "status");
    const ownerId = stringField(contract, "ownerId") ?? stringField(contract, "owner_id");
    const endDate = stringField(contract, "endDate") ?? stringField(contract, "end_date");
    const renewalDate = stringField(contract, "renewalDate") ?? stringField(contract, "renewal_date");
    const noticeDeadline = stringField(contract, "noticeDeadline") ?? stringField(contract, "notice_deadline");
    const effectiveDate = stringField(contract, "effectiveDate") ?? stringField(contract, "effective_date");
    const counterparty = stringField(contract, "counterparty");
    const canonicalCounterparty = canonicalizeCounterparty(counterparty);

    if ((status === "active" || status === "pending_review") && !ownerId) {
      addIssue(issues, { check: "missing-owners", entityType: "contract", entityId: id, severity: "P0", reason: "owner_id_missing" });
    }
    if (status === "active" && (!endDate || !renewalDate || !noticeDeadline)) {
      addIssue(issues, { check: "missing-key-dates", entityType: "contract", entityId: id, severity: "P0", reason: "active_contract_missing_key_dates" });
    }
    if (!CONTRACT_STATUSES.has(status as ContractLifecycleStatus)) {
      addIssue(issues, { check: "invalid-enum-values", entityType: "contract", entityId: id, severity: "P0", reason: "invalid_contract_status" });
    }
    const effectiveMs = dateOnlyToUtcMs(effectiveDate);
    const endMs = dateOnlyToUtcMs(endDate);
    const renewalMs = dateOnlyToUtcMs(renewalDate);
    const noticeMs = dateOnlyToUtcMs(noticeDeadline);
    if ((effectiveDate && effectiveMs == null) || (endDate && endMs == null) || (renewalDate && renewalMs == null) || (noticeDeadline && noticeMs == null)) {
      addIssue(issues, { check: "impossible-dates", entityType: "contract", entityId: id, severity: "P0", reason: "invalid_date_value" });
    }
    if ((effectiveMs != null && endMs != null && effectiveMs > endMs) || (renewalMs != null && endMs != null && renewalMs > endMs) || (noticeMs != null && renewalMs != null && noticeMs > renewalMs)) {
      addIssue(issues, { check: "invalid-renewal-windows", entityType: "contract", entityId: id, severity: "P0", reason: "date_ordering_violation" });
    }
    if (canonicalCounterparty) {
      const group = counterpartyGroups.get(canonicalCounterparty) ?? [];
      group.push(id);
      counterpartyGroups.set(canonicalCounterparty, group);
    }
    if (stringField(contract, "billingStatus") === "active" && stringField(contract, "workspaceMode") !== "core" && !stringField(contract, "stripeSubscriptionId")) {
      addIssue(issues, { check: "inconsistent-billing-metadata", entityType: "contract", entityId: id, severity: "P1", reason: "active_paid_workspace_missing_subscription" });
    }
  }

  for (const [counterparty, ids] of [...counterpartyGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (ids.length > 1) {
      addIssue(issues, {
        check: "duplicate-counterparties",
        entityType: "contract",
        entityId: ids.join(","),
        severity: "P1",
        reason: `duplicate_canonical_counterparty:${counterparty}`,
      });
    }
  }

  for (const task of snapshot.tasks ?? []) {
    const id = stringField(task, "id") ?? "(missing)";
    const contractId = stringField(task, "contractId") ?? stringField(task, "contract_id");
    if (!contractId || !contractIds.has(contractId)) {
      addIssue(issues, { check: "orphaned-tasks", entityType: "task", entityId: id, severity: "P1", reason: "task_contract_missing" });
    }
  }

  for (const evidence of snapshot.evidenceRequirements ?? []) {
    const id = stringField(evidence, "id") ?? "(missing)";
    const contractId = stringField(evidence, "contractId") ?? stringField(evidence, "contract_id");
    if (!contractId || !contractIds.has(contractId)) {
      addIssue(issues, { check: "orphaned-evidence", entityType: "evidence_requirement", entityId: id, severity: "P1", reason: "evidence_contract_missing" });
    }
  }

  for (const job of snapshot.importJobs ?? []) {
    const id = stringField(job, "id") ?? "(missing)";
    const status = stringField(job, "status");
    const updatedMs = isoToMs(stringField(job, "updatedAt") ?? stringField(job, "updated_at"));
    const generatedMs = isoToMs(snapshot.generatedAt) ?? 0;
    if (status === "processing" && updatedMs != null && generatedMs - updatedMs > 24 * 60 * 60 * 1000) {
      addIssue(issues, { check: "stale-imports", entityType: "import_job", entityId: id, severity: "P1", reason: "processing_import_stale" });
    }
  }

  for (const readModel of snapshot.readModels ?? []) {
    const id = stringField(readModel, "id") ?? `${stringField(readModel, "modelKey") ?? "model"}:${stringField(readModel, "sourceId") ?? "source"}`;
    const sourceId = stringField(readModel, "sourceId") ?? stringField(readModel, "source_id");
    const sourceUpdatedMs = isoToMs(stringField(readModel, "sourceUpdatedAt") ?? stringField(readModel, "source_updated_at"));
    const computedMs = isoToMs(stringField(readModel, "computedAt") ?? stringField(readModel, "computed_at"));
    if (sourceId && !contractIds.has(sourceId) && stringField(readModel, "sourceTable") === "contracts") {
      addIssue(issues, { check: "broken-read-models", entityType: "read_model", entityId: id, severity: "P1", reason: "source_contract_missing" });
    }
    if (sourceUpdatedMs != null && computedMs != null && computedMs < sourceUpdatedMs) {
      addIssue(issues, { check: "stale-derived-fields", entityType: "read_model", entityId: id, severity: "P1", reason: "read_model_older_than_source" });
    }
    if (!stringField(readModel, "lineageId") && !stringField(readModel, "lineage_id")) {
      addIssue(issues, { check: "dangling-foreign-keys", entityType: "read_model", entityId: id, severity: "P1", reason: "lineage_missing" });
    }
  }

  return {
    generatedAt: snapshot.generatedAt,
    issueCount: issues.length,
    issues: issues.sort((a, b) => `${a.check}:${a.entityId}:${a.reason}`.localeCompare(`${b.check}:${b.entityId}:${b.reason}`)),
    coverage: OPERATIONAL_DATA_QUALITY_REPORT_CHECKS,
  };
}

export function normalizeImportRow(row: ImportSourceRow): NormalizedImportRow {
  const title = normalizeWhitespace(row.title ?? "");
  const canonicalCounterparty = canonicalizeCounterparty(row.counterparty);
  const ownerEmail = row.ownerEmail ? normalizeWhitespace(row.ownerEmail).toLocaleLowerCase("en-US") : null;
  const effectiveDate = dateOnlyToUtcMs(row.effectiveDate) == null ? null : String(row.effectiveDate).trim().slice(0, 10);
  const endDate = dateOnlyToUtcMs(row.endDate) == null ? null : String(row.endDate).trim().slice(0, 10);
  const errors: string[] = [];
  if (!title) errors.push("missing_title");
  if (!canonicalCounterparty) errors.push("missing_counterparty");
  if (row.effectiveDate && !effectiveDate) errors.push("bad_effective_date");
  if (row.endDate && !endDate) errors.push("bad_end_date");
  if (row.encodingSample?.includes("\uFFFD")) errors.push("invalid_encoding");
  if (effectiveDate && endDate && (dateOnlyToUtcMs(effectiveDate) ?? 0) > (dateOnlyToUtcMs(endDate) ?? 0)) errors.push("effective_after_end");

  return {
    rowId: row.rowId,
    fileHash: row.fileHash,
    retryOfRowId: row.retryOfRowId ?? null,
    title,
    canonicalCounterparty,
    ownerEmail,
    effectiveDate,
    endDate,
    contractKey: [title.toLocaleLowerCase("en-US"), canonicalCounterparty, endDate ?? ""].join("|"),
    valid: errors.length === 0,
    errors,
  };
}

export function buildImportReconciliationReport(rows: readonly ImportSourceRow[]): ImportReconciliationReport {
  const normalizedRows = rows.map(normalizeImportRow).sort((a, b) => a.rowId.localeCompare(b.rowId));
  const sourceByRowId = new Map(rows.map((row) => [row.rowId, row] as const));
  const byFile = new Map<string, string[]>();
  const byContract = new Map<string, string[]>();
  const displayByCounterparty = new Map<string, Set<string>>();
  const partialRetryRowIds: string[] = [];

  for (const row of normalizedRows) {
    if (row.fileHash) byFile.set(row.fileHash, [...(byFile.get(row.fileHash) ?? []), row.rowId]);
    if (row.contractKey !== "||") byContract.set(row.contractKey, [...(byContract.get(row.contractKey) ?? []), row.rowId]);
    if (row.canonicalCounterparty) {
      const displays = displayByCounterparty.get(row.canonicalCounterparty) ?? new Set<string>();
      displays.add(normalizeWhitespace(sourceByRowId.get(row.rowId)?.counterparty ?? ""));
      displayByCounterparty.set(row.canonicalCounterparty, displays);
    }
    if (row.retryOfRowId && row.valid) partialRetryRowIds.push(row.rowId);
  }

  const duplicateFileHashes = [...byFile.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([hash]) => hash)
    .sort();
  const duplicateContractKeys = [...byContract.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key]) => key)
    .sort();
  const inconsistentCounterpartyNames = [...displayByCounterparty.entries()]
    .filter(([, displays]) => displays.size > 1)
    .map(([key]) => key)
    .sort();

  const issueCount =
    duplicateFileHashes.length +
    duplicateContractKeys.length +
    inconsistentCounterpartyNames.length +
    normalizedRows.reduce((count, row) => count + row.errors.length, 0);

  return {
    normalizedRows,
    duplicateFileHashes,
    duplicateContractKeys,
    inconsistentCounterpartyNames,
    partialRetryRowIds: partialRetryRowIds.sort(),
    issueCount,
  };
}

function readModelOutputKey(row: Pick<ReadModelRow, "modelKey" | "sourceTable" | "sourceId">): string {
  return `${row.modelKey}:${row.sourceTable}:${row.sourceId}`;
}

export function evaluateReadModelSafety(input: {
  sourceRows: readonly ReadModelSourceRow[];
  readModelRows: readonly ReadModelRow[];
  rebuildRows: readonly ReadModelRow[];
  scopeSourceIds?: readonly string[];
}): ReadModelSafetyReport {
  const issues: Array<{ check: string; sourceId: string; reason: string }> = [];
  const sources = new Map<string, ReadModelSourceRow>(input.sourceRows.map((row) => [`${row.sourceTable}:${row.sourceId}`, row]));
  const scopedSourceIds = new Set(input.scopeSourceIds ?? input.sourceRows.map((row) => row.sourceId));
  const seenRebuildKeys = new Set<string>();
  const expectedOutputKeys = input.rebuildRows.map(readModelOutputKey).sort();
  const currentHashes = new Map(input.readModelRows.map((row) => [readModelOutputKey(row), row.payloadHash] as const));

  for (const row of input.rebuildRows) {
    const key = readModelOutputKey(row);
    const sourceKey = `${row.sourceTable}:${row.sourceId}`;
    const source = sources.get(sourceKey);
    if (seenRebuildKeys.has(key)) {
      issues.push({ check: "rebuild-idempotency", sourceId: row.sourceId, reason: "duplicate_rebuild_output_key" });
    }
    seenRebuildKeys.add(key);
    if (!source) {
      issues.push({ check: "missing-source-rows", sourceId: row.sourceId, reason: "read_model_source_missing" });
      continue;
    }
    if (!scopedSourceIds.has(row.sourceId)) {
      issues.push({ check: "partial-rebuild", sourceId: row.sourceId, reason: "row_outside_rebuild_scope" });
    }
    if (isoToMs(row.computedAt) != null && isoToMs(source.updatedAt) != null && (isoToMs(row.computedAt) ?? 0) < (isoToMs(source.updatedAt) ?? 0)) {
      issues.push({ check: "stale-source-data", sourceId: row.sourceId, reason: "computed_before_source_update" });
    }
    if (!row.lineageId) {
      issues.push({ check: "lineage-required", sourceId: row.sourceId, reason: "lineage_missing" });
    }
    if (row.version < source.version) {
      issues.push({ check: "concurrent-rebuild", sourceId: row.sourceId, reason: "rebuild_version_behind_source" });
    }
    const currentHash = currentHashes.get(key);
    if (currentHash && currentHash !== row.payloadHash && row.version === source.version) {
      issues.push({ check: "output-drift", sourceId: row.sourceId, reason: "same_version_hash_changed" });
    }
  }

  return { ok: issues.length === 0, issues: issues.sort((a, b) => `${a.check}:${a.sourceId}`.localeCompare(`${b.check}:${b.sourceId}`)), expectedOutputKeys };
}

export function resolveCacheInvalidationDecision(input: CacheInvalidationInput): CacheInvalidationDecision {
  const reasons: string[] = [];
  const sourceMs = isoToMs(input.sourceUpdatedAt);
  const cacheMs = isoToMs(input.cacheGeneratedAt);
  if (input.sensitive) reasons.push("sensitive_cache_bypass");
  if (input.sourceVersion > input.cacheVersion) reasons.push("source_version_newer");
  if (sourceMs != null && cacheMs != null && sourceMs > cacheMs) reasons.push("source_updated_after_cache");
  return {
    invalidate: reasons.length > 0,
    bypassCache: input.sensitive,
    fallbackRead: input.fallbackAvailable && reasons.length > 0,
    reasons,
  };
}
