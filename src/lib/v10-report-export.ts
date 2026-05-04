import {
  V10_CORE_REPORT_FAMILIES,
  type V10Plan,
  type V10ReportFamily,
} from "./v10-release-contract";

export type V10ReportExportThresholdInput = {
  rowCount?: number | null;
  estimatedJsonBytes?: number | null;
  estimatedExecutionMs?: number | null;
};
export type V10ReportExportReliabilityState =
  | "async_handoff_required"
  | "delivered"
  | "partial_retryable"
  | "failed_retryable"
  | "failed_terminal"
  | "pending";
export type V10ReportExportDeliveryState =
  | "not_requested"
  | "queued"
  | "sent"
  | "failed_retryable"
  | "failed_terminal";

export type V10ReportExportArtifactContract = {
  artifactId: string;
  family: V10ReportFamily;
  selectedRowCount: number;
  generatedRowCount: number;
  checksum: string | null;
  expiresAt: string | null;
  scopedDownloadHref: string | null;
  retryAction: "retry" | null;
  cancelAction: "cancel" | null;
  revokeAction: "revoke" | null;
  redactionApplied: boolean;
  csvFormulaNeutralized: boolean;
};

export type V10ReportExportArtifactManifest = {
  artifact_id: string;
  family: V10ReportFamily;
  selected_row_count: number;
  generated_row_count: number;
  truncation_summary: string | null;
  delivery_state: V10ReportExportDeliveryState;
  operational_review_due: boolean;
  checksum: string;
  scoped_download_href: string;
  expires_at: string;
};

export type V10DeliveryPrivacyContract = {
  deliveryKind: "report_email" | "export_download" | "notification" | "external_evidence_link" | "runtime_artifact";
  recipientScope: "actor" | "organization" | "external_token" | "service_role_only";
  privateCacheRequired: boolean;
  redactionRequired: boolean;
  tokenHashOnly: boolean;
  retentionDays: number;
  auditAction: string;
  prohibitedPayloadFields: readonly string[];
};

export const V10_DELIVERY_PRIVACY_CONTRACTS: readonly V10DeliveryPrivacyContract[] = [
  {
    deliveryKind: "report_email",
    recipientScope: "organization",
    privateCacheRequired: true,
    redactionRequired: true,
    tokenHashOnly: true,
    retentionDays: 30,
    auditAction: "report.delivery_attempted",
    prohibitedPayloadFields: ["raw_contract_text", "signed_url", "recipient_email"],
  },
  {
    deliveryKind: "export_download",
    recipientScope: "actor",
    privateCacheRequired: true,
    redactionRequired: true,
    tokenHashOnly: true,
    retentionDays: 30,
    auditAction: "export.downloaded",
    prohibitedPayloadFields: ["raw_contract_text", "signed_url", "token", "formula_unescaped"],
  },
  {
    deliveryKind: "notification",
    recipientScope: "actor",
    privateCacheRequired: true,
    redactionRequired: true,
    tokenHashOnly: true,
    retentionDays: 30,
    auditAction: "notification.delivery_attempted",
    prohibitedPayloadFields: ["private_note", "raw_clause", "email_address"],
  },
  {
    deliveryKind: "external_evidence_link",
    recipientScope: "external_token",
    privateCacheRequired: true,
    redactionRequired: true,
    tokenHashOnly: true,
    retentionDays: 14,
    auditAction: "evidence_link.opened",
    prohibitedPayloadFields: ["organization_name", "signed_link_token", "responder_email"],
  },
  {
    deliveryKind: "runtime_artifact",
    recipientScope: "service_role_only",
    privateCacheRequired: true,
    redactionRequired: true,
    tokenHashOnly: true,
    retentionDays: 30,
    auditAction: "runtime_artifact.accessed",
    prohibitedPayloadFields: ["customer_payload", "secret", "provider_credentials"],
  },
] as const;

export function isV10CoreReportFamily(value: string): value is V10ReportFamily {
  return (V10_CORE_REPORT_FAMILIES as readonly string[]).includes(value);
}

export function getV10ReportFamilyForRun(reportMode?: string | null): V10ReportFamily {
  const normalized = String(reportMode ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isV10CoreReportFamily(normalized)) return normalized;
  if (normalized.includes("renewal")) return "renewal_horizon_report";
  if (normalized.includes("overdue") || normalized.includes("work") || normalized.includes("obligation")) {
    return "overdue_work_report";
  }
  if (normalized.includes("exception")) return "exception_report";
  if (normalized.includes("evidence")) return "evidence_status_report";
  if (normalized.includes("approval") || normalized.includes("sla")) return "approval_sla_report";
  if (normalized.includes("quality") || normalized.includes("field")) return "data_quality_report";
  if (normalized.includes("audit") || normalized.includes("activity")) return "audit_activity_report";
  if (normalized.includes("import") || normalized.includes("extraction")) return "import_extraction_reliability_report";
  if (normalized.includes("health") || normalized.includes("settings")) return "workspace_health_report";
  return "contract_portfolio_summary";
}

function isV10Plan(value: unknown): value is V10Plan {
  return ["trial", "core", "advanced", "assurance", "enterprise"].includes(String(value ?? ""));
}

export function resolveV10ReportExportPlan(v6?: unknown): V10Plan {
  const settings = v6 && typeof v6 === "object" ? (v6 as Record<string, unknown>) : {};
  const rawPlan = settings.workspace_plan ?? settings.billing_plan ?? settings.subscription_plan ?? settings.plan ?? settings.workspace_mode;
  return isV10Plan(rawPlan) ? rawPlan : "enterprise";
}

export function getV10ContractExportRowLimit(plan: V10Plan): number {
  switch (plan) {
    case "trial":
      return 5_000;
    case "core":
      return 10_000;
    case "advanced":
    case "assurance":
    case "enterprise":
    default:
      return 20_000;
  }
}

export function isV10AsyncReportOrExportRequired(input: V10ReportExportThresholdInput): boolean {
  return (
    (input.rowCount ?? 0) > 50 ||
    (input.estimatedJsonBytes ?? 0) > 2 * 1024 * 1024 ||
    (input.estimatedExecutionMs ?? 0) > 5_000
  );
}

export function neutralizeV10CsvFormulaCell(value: string): string {
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

export function describeV10Truncation(input: {
  selectedRowCount: number;
  exportedRowCount: number;
  reason?: string | null;
}): string | null {
  if (input.exportedRowCount >= input.selectedRowCount) return null;
  return (
    input.reason ??
    `${input.exportedRowCount} of ${input.selectedRowCount} selected rows were exported before the row limit was reached.`
  );
}

export function getV10ReportExportReliabilityState(input: V10ReportExportThresholdInput & {
  status?: string | null;
  selectedRowCount?: number | null;
  generatedRowCount?: number | null;
  retryableCount?: number | null;
  artifactUrl?: string | null;
}): V10ReportExportReliabilityState {
  if (isV10AsyncReportOrExportRequired(input) && !input.status) return "async_handoff_required";
  if (input.status === "succeeded" || input.status === "completed") {
    if (
      input.selectedRowCount != null &&
      input.generatedRowCount != null &&
      input.generatedRowCount < input.selectedRowCount
    ) {
      return "partial_retryable";
    }
    return "delivered";
  }
  if (input.status === "partial") return "partial_retryable";
  if (input.status === "failed_retryable" || (input.status === "failed" && (input.retryableCount ?? 0) > 0)) {
    return "failed_retryable";
  }
  if (input.status === "failed" || input.status === "failed_terminal") return "failed_terminal";
  return "pending";
}

export function getV10ReportExportDeliveryState(input: {
  deliveryRequested?: boolean;
  deliveredAt?: string | null;
  failureCategory?: string | null;
  retryable?: boolean;
}): V10ReportExportDeliveryState {
  if (!input.deliveryRequested) return "not_requested";
  if (input.deliveredAt) return "sent";
  if (input.failureCategory) return input.retryable === false ? "failed_terminal" : "failed_retryable";
  return "queued";
}

export function buildV10ReportExportArtifactManifest(input: V10ReportExportArtifactContract & {
  deliveryRequested?: boolean;
  deliveredAt?: string | null;
  failureCategory?: string | null;
  retryable?: boolean;
  now?: Date;
}): V10ReportExportArtifactManifest | null {
  const failures = validateV10ReportExportArtifactContract(input);
  if (failures.length > 0 || !input.checksum || !input.scopedDownloadHref || !input.expiresAt) return null;
  const deliveryState = getV10ReportExportDeliveryState(input);
  const expiresAtMs = Date.parse(input.expiresAt);
  const nowMs = (input.now ?? new Date()).getTime();
  return {
    artifact_id: input.artifactId,
    family: input.family,
    selected_row_count: input.selectedRowCount,
    generated_row_count: input.generatedRowCount,
    truncation_summary: describeV10Truncation({
      selectedRowCount: input.selectedRowCount,
      exportedRowCount: input.generatedRowCount,
    }),
    delivery_state: deliveryState,
    operational_review_due: deliveryState === "failed_retryable" || deliveryState === "failed_terminal" || expiresAtMs - nowMs < 86_400_000,
    checksum: input.checksum,
    scoped_download_href: input.scopedDownloadHref,
    expires_at: input.expiresAt,
  };
}

export function validateV10ReportExportArtifactContract(artifact: V10ReportExportArtifactContract): string[] {
  const failures: string[] = [];
  if (!artifact.artifactId) failures.push("artifact_id_required");
  if (!isV10CoreReportFamily(artifact.family)) failures.push("core_report_family_required");
  if (artifact.generatedRowCount > artifact.selectedRowCount) failures.push("generated_count_exceeds_selected");
  if (!artifact.checksum?.startsWith("sha256:")) failures.push("checksum_required");
  if (!artifact.expiresAt) failures.push("expiry_required");
  if (!artifact.scopedDownloadHref?.startsWith("/api/")) failures.push("scoped_download_required");
  if (!artifact.redactionApplied) failures.push("redaction_required");
  if (!artifact.csvFormulaNeutralized) failures.push("csv_formula_neutralization_required");
  if (artifact.generatedRowCount < artifact.selectedRowCount && !artifact.retryAction) failures.push("partial_artifact_retry_required");
  if (!artifact.revokeAction) failures.push("artifact_revoke_required");
  return failures;
}

export function validateV10DeliveryPrivacyContracts(
  contracts: readonly V10DeliveryPrivacyContract[] = V10_DELIVERY_PRIVACY_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.deliveryKind)) failures.push(`duplicate_delivery_contract:${contract.deliveryKind}`);
    seen.add(contract.deliveryKind);
    if (!contract.privateCacheRequired) failures.push(`${contract.deliveryKind}:private_no_store_required`);
    if (!contract.redactionRequired) failures.push(`${contract.deliveryKind}:redaction_required`);
    if (!contract.tokenHashOnly) failures.push(`${contract.deliveryKind}:token_hash_only_required`);
    if (contract.retentionDays <= 0) failures.push(`${contract.deliveryKind}:retention_required`);
    if (!contract.auditAction.includes(".")) failures.push(`${contract.deliveryKind}:audit_action_required`);
    if (contract.prohibitedPayloadFields.length === 0) failures.push(`${contract.deliveryKind}:prohibited_fields_required`);
  }
  for (const deliveryKind of ["report_email", "export_download", "notification", "external_evidence_link", "runtime_artifact"] as const) {
    if (!seen.has(deliveryKind)) failures.push(`delivery_contract_missing:${deliveryKind}`);
  }
  return failures;
}
