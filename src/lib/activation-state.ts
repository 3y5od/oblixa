import {
  V10_ACTIVATION_STATES,
  type V10OwnerState,
} from "./release-contract";
import { buildV10ValidationFailure, type V10ValidationFailure } from "./mutation-envelope";

export type V10ActivationState = (typeof V10_ACTIVATION_STATES)[number];

export type V10UploadCandidate = {
  fileType: "pdf" | "docx" | "txt" | string;
  sizeBytes: number;
  textContentLength: number;
  malwareScanStatus?: "passed" | "failed" | "pending";
  authenticatedUploader: boolean;
};

export type V10ImportCandidate = {
  columns: string[];
  rowCount: number;
  parseErrorRows: number;
  duplicateRecordCount?: number;
  encoding: string;
};

export type V10DuplicateImportCandidate = {
  rowId: string;
  title: string | null;
  counterparty: string | null;
  effectiveDate?: string | null;
  sourceFileHash?: string | null;
  importSourceId?: string | null;
};

export type V10DuplicateImportGroup = {
  duplicate_key: string;
  row_ids: string[];
  title: string;
  counterparty: string;
  effective_date: string | null;
};

export type V10FirstWorkGenerationMetric = {
  included: boolean;
  elapsed_minutes: number | null;
  within_10_minutes: boolean;
  exclusion_reason: string | null;
};

export const V10_MAX_IMPORT_ROWS = 10_000;

export type V10ActivationInput = {
  acceptedAt?: string | null;
  durableJobId?: string | null;
  extractionStartedAt?: string | null;
  extractionCompletedAt?: string | null;
  extractionFailed?: boolean;
  extractionPartial?: boolean;
  requiredFieldsTotal: number;
  requiredFieldsApproved: number;
  ownerState: V10OwnerState;
  firstGeneratedWorkItemId?: string | null;
  firstGeneratedWorkItemAt?: string | null;
  dashboardUpdatedAt?: string | null;
};

export type V10ActivationEvidenceSummary = {
  state: V10ActivationState;
  durable_job_id: string | null;
  blocked_reason: string | null;
  next_action: string;
  required_fields_total: number;
  required_fields_approved: number;
  first_generated_work_item_id: string | null;
  ready_for_release_measurement: boolean;
};

export function isV10ValidUpload(candidate: V10UploadCandidate): boolean {
  return validateV10UploadCandidate(candidate).length === 0;
}

export function validateV10UploadCandidate(candidate: V10UploadCandidate): V10ValidationFailure[] {
  const failures: V10ValidationFailure[] = [];
  const allowed = candidate.fileType === "pdf" || candidate.fileType === "docx" || candidate.fileType === "txt";
  if (!candidate.authenticatedUploader) {
    failures.push(buildV10ValidationFailure("uploader", "unauthenticated", "Sign in before uploading contracts.", false));
  }
  if (!allowed) {
    failures.push(buildV10ValidationFailure("file_type", "unsupported", "Upload a PDF, DOCX, or TXT contract file.", true));
  }
  if (candidate.sizeBytes <= 0) {
    failures.push(buildV10ValidationFailure("file", "empty", "Upload a non-empty contract file.", true));
  }
  if (candidate.sizeBytes >= 25 * 1024 * 1024) {
    failures.push(buildV10ValidationFailure("file", "too_large", "Contract uploads must be smaller than 25 MB.", true));
  }
  if (candidate.textContentLength <= 0) {
    failures.push(buildV10ValidationFailure("text", "no_extractable_text", "The file must contain extractable contract text.", true));
  }
  if (candidate.malwareScanStatus === "failed") {
    failures.push(buildV10ValidationFailure("malware_scan", "failed", "The file did not pass malware scanning.", false));
  }
  if (candidate.malwareScanStatus === "pending") {
    failures.push(buildV10ValidationFailure("malware_scan", "pending", "Wait for malware scanning to finish before activation.", false));
  }
  return failures;
}

export function isV10ValidImport(candidate: V10ImportCandidate): boolean {
  return validateV10ImportCandidate(candidate).length === 0;
}

export function validateV10ImportCandidate(candidate: V10ImportCandidate): V10ValidationFailure[] {
  const failures: V10ValidationFailure[] = [];
  const columns = new Set(candidate.columns.map((value) => value.toLowerCase()));
  const parseErrorRate = candidate.rowCount > 0 ? candidate.parseErrorRows / candidate.rowCount : 1;
  if (!columns.has("title")) {
    failures.push(buildV10ValidationFailure("title", "required_column", "CSV import requires a title column.", true));
  }
  if (!columns.has("counterparty")) {
    failures.push(
      buildV10ValidationFailure("counterparty", "required_column", "CSV import requires a counterparty column.", true)
    );
  }
  if (candidate.rowCount <= 0) {
    failures.push(buildV10ValidationFailure("rows", "empty", "CSV import must include at least one row.", true));
  }
  if (candidate.rowCount >= V10_MAX_IMPORT_ROWS) {
    failures.push(
      buildV10ValidationFailure("rows", "too_many_rows", "CSV import must contain fewer than 10,000 rows.", true)
    );
  }
  if (candidate.encoding.toLowerCase() !== "utf-8") {
    failures.push(buildV10ValidationFailure("encoding", "unsupported", "CSV import must use UTF-8 encoding.", true));
  }
  if (parseErrorRate > 0.05) {
    failures.push(
      buildV10ValidationFailure(
        "rows",
        "parse_error_rate",
        "CSV import has row-level parse errors in more than 5% of rows.",
        true
      )
    );
  }
  if ((candidate.duplicateRecordCount ?? 0) > 0) {
    failures.push(
      buildV10ValidationFailure("rows", "duplicate_records", "CSV import contains duplicate contract records that need review.", true)
    );
  }
  return failures;
}

function normalizeDuplicateValue(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function findV10DuplicateImportCandidates(
  candidates: readonly V10DuplicateImportCandidate[]
): V10DuplicateImportGroup[] {
  const groups = new Map<string, V10DuplicateImportCandidate[]>();
  for (const candidate of candidates) {
    const title = normalizeDuplicateValue(candidate.title);
    const counterparty = normalizeDuplicateValue(candidate.counterparty);
    const effectiveDate = normalizeDuplicateValue(candidate.effectiveDate);
    const sourceFileHash = normalizeDuplicateValue(candidate.sourceFileHash);
    const importSourceId = normalizeDuplicateValue(candidate.importSourceId);
    const duplicateKeys = new Set<string>();
    if (title && counterparty) {
      duplicateKeys.add(`${title}|${counterparty}|${effectiveDate}`);
    }
    if (sourceFileHash) duplicateKeys.add(`source_file_hash:${sourceFileHash}`);
    if (importSourceId) duplicateKeys.add(`import_source_id:${importSourceId}`);
    for (const duplicateKey of duplicateKeys) {
      groups.set(duplicateKey, [...(groups.get(duplicateKey) ?? []), candidate]);
    }
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([duplicateKey, rows]) => ({
      duplicate_key: duplicateKey,
      row_ids: rows.map((row) => row.rowId),
      title: normalizeDuplicateValue(rows[0]?.title),
      counterparty: normalizeDuplicateValue(rows[0]?.counterparty),
      effective_date: normalizeDuplicateValue(rows[0]?.effectiveDate) || null,
    }));
}

export function buildV10FirstWorkGenerationMetric(input: {
  acceptedAt?: string | null;
  firstGeneratedWorkItemAt?: string | null;
  exclusionReason?: string | null;
}): V10FirstWorkGenerationMetric {
  if (input.exclusionReason) {
    return {
      included: false,
      elapsed_minutes: null,
      within_10_minutes: false,
      exclusion_reason: input.exclusionReason,
    };
  }
  if (!input.acceptedAt || !input.firstGeneratedWorkItemAt) {
    return {
      included: false,
      elapsed_minutes: null,
      within_10_minutes: false,
      exclusion_reason: "missing_activation_timestamp",
    };
  }
  const acceptedAtMs = Date.parse(input.acceptedAt);
  const firstWorkAtMs = Date.parse(input.firstGeneratedWorkItemAt);
  if (!Number.isFinite(acceptedAtMs) || !Number.isFinite(firstWorkAtMs) || firstWorkAtMs < acceptedAtMs) {
    return {
      included: false,
      elapsed_minutes: null,
      within_10_minutes: false,
      exclusion_reason: "invalid_activation_timing",
    };
  }
  const elapsedMinutes = Math.round(((firstWorkAtMs - acceptedAtMs) / 60_000) * 100) / 100;
  return {
    included: true,
    elapsed_minutes: elapsedMinutes,
    within_10_minutes: elapsedMinutes <= 10,
    exclusion_reason: null,
  };
}

export function deriveV10ActivationState(input: V10ActivationInput): V10ActivationState {
  if (input.dashboardUpdatedAt) return "dashboard_updated";
  if (input.firstGeneratedWorkItemId && input.firstGeneratedWorkItemAt) return "first_work_item_generated";
  if (input.ownerState === "assigned" && input.requiredFieldsApproved >= input.requiredFieldsTotal) return "owner_assigned";
  if (input.requiredFieldsTotal > 0 && input.requiredFieldsApproved >= input.requiredFieldsTotal) return "required_fields_approved";
  if (input.acceptedAt && input.requiredFieldsTotal > input.requiredFieldsApproved) return "required_field_review_ready";
  if (input.extractionFailed) return "extraction_failed";
  if (input.extractionPartial) return "extraction_partially_complete";
  if (input.extractionStartedAt && !input.extractionCompletedAt) return "extraction_running";
  if (input.durableJobId) return "extraction_queued";
  if (input.acceptedAt) return "contract_uploaded_or_imported";
  return "workspace_prepared";
}

export function isV10ActivationComplete(input: V10ActivationInput): boolean {
  return deriveV10ActivationState(input) === "dashboard_updated";
}

export function getV10ActivationBlockedReason(input: V10ActivationInput): string | null {
  if (!input.acceptedAt || !input.durableJobId) return "file_acceptance_missing";
  if (input.extractionFailed) return "extraction_failed";
  if (input.requiredFieldsApproved < input.requiredFieldsTotal) return "required_fields_unapproved";
  if (input.ownerState !== "assigned") return "owner_unassigned";
  if (!input.firstGeneratedWorkItemId) return "first_generated_work_item_missing";
  if (!input.dashboardUpdatedAt) return "dashboard_not_updated";
  return null;
}

export function buildV10ActivationEvidenceSummary(input: V10ActivationInput): V10ActivationEvidenceSummary {
  const state = deriveV10ActivationState(input);
  const blockedReason = getV10ActivationBlockedReason(input);
  return {
    state,
    durable_job_id: input.durableJobId ?? null,
    blocked_reason: blockedReason,
    next_action: blockedReason ? `resolve_${blockedReason}` : "open_daily_brief",
    required_fields_total: input.requiredFieldsTotal,
    required_fields_approved: input.requiredFieldsApproved,
    first_generated_work_item_id: input.firstGeneratedWorkItemId ?? null,
    ready_for_release_measurement: state === "dashboard_updated" && blockedReason === null,
  };
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10ActivationEvidenceSummary as buildActivationEvidenceSummary };
export { buildV10FirstWorkGenerationMetric as buildFirstWorkGenerationMetric };
export { deriveV10ActivationState as deriveActivationState };
export { findV10DuplicateImportCandidates as findDuplicateImportCandidates };
export { getV10ActivationBlockedReason as getActivationBlockedReason };
export { isV10ActivationComplete as isActivationComplete };
export { isV10ValidImport as isValidImport };
export { isV10ValidUpload as isValidUpload };
export { V10_MAX_IMPORT_ROWS as MAX_IMPORT_ROWS };
export { validateV10ImportCandidate as validateImportCandidate };
export { validateV10UploadCandidate as validateUploadCandidate };
export type { V10ActivationEvidenceSummary as ActivationEvidenceSummary };
export type { V10ActivationInput as ActivationInput };
export type { V10ActivationState as ActivationState };
export type { V10DuplicateImportCandidate as DuplicateImportCandidate };
export type { V10DuplicateImportGroup as DuplicateImportGroup };
export type { V10FirstWorkGenerationMetric as FirstWorkGenerationMetric };
export type { V10ImportCandidate as ImportCandidate };
export type { V10UploadCandidate as UploadCandidate };
// End version-name compatibility aliases.
