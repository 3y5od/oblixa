export type PrivacyInventoryKind =
  | "table"
  | "storage_bucket"
  | "telemetry_event"
  | "export_surface"
  | "provider";

export type PrivacySubjectScope =
  | "user"
  | "organization"
  | "contract"
  | "external_recipient"
  | "provider_account";

export type PrivacyExportMode = "include" | "count" | "metadata_only";
export type PrivacyDeleteMode =
  | "cascade_delete"
  | "legal_hold_guarded"
  | "operator_review"
  | "revoke_and_redact"
  | "not_applicable";

export type PrivacyRetentionClass =
  | "account_lifecycle"
  | "contract_lifecycle"
  | "transient_7d"
  | "transient_30d"
  | "transient_180d"
  | "audit_immutable"
  | "provider_operational"
  | "legal_boundary";

export type PrivacyRedactionClass =
  | "none"
  | "field_level"
  | "metadata_only"
  | "hash_or_token_prefix_only"
  | "provider_failure_redacted";

export type PrivacyAccessClass =
  | "self_service"
  | "org_member"
  | "org_admin"
  | "service_role_only"
  | "provider_console_manual";

export type PrivacyDeletionClass =
  | "delete_on_subject_request"
  | "legal_hold_guarded_delete"
  | "operator_review_required"
  | "revoke_token_then_redact"
  | "append_only_exempt";

export type PrivacyInventoryRecord = {
  dataClass: string;
  kind: PrivacyInventoryKind;
  subjectScopes: PrivacySubjectScope[];
  table?: string;
  columns?: string[];
  storageBucket?: string;
  storagePathField?: string;
  telemetryEvent?: string;
  exportSurface?: string;
  provider?: string;
  providerFields?: string[];
  userField?: string;
  organizationField?: string;
  contractField?: string;
  containsPii: boolean;
  piiFields: string[];
  retentionClass: PrivacyRetentionClass;
  redactionClass: PrivacyRedactionClass;
  accessClass: PrivacyAccessClass;
  deletionClass: PrivacyDeletionClass;
  exportMode: PrivacyExportMode;
  deleteMode: PrivacyDeleteMode;
};

export type PrivacyClassificationIssue = {
  dataClass: string;
  issue: string;
  field?: string;
};

export const PRIVACY_INVENTORY_SCHEMA_VERSION = 2;

export const PRIVACY_SAFE_RECORD_INVENTORY: PrivacyInventoryRecord[] = [
  {
    dataClass: "profile",
    kind: "table",
    subjectScopes: ["user"],
    table: "profiles",
    columns: ["id", "full_name", "legal_hold", "created_at"],
    userField: "id",
    containsPii: true,
    piiFields: ["full_name"],
    retentionClass: "account_lifecycle",
    redactionClass: "field_level",
    accessClass: "self_service",
    deletionClass: "legal_hold_guarded_delete",
    exportMode: "include",
    deleteMode: "legal_hold_guarded",
  },
  {
    dataClass: "membership",
    kind: "table",
    subjectScopes: ["user", "organization"],
    table: "organization_members",
    columns: ["user_id", "organization_id", "role", "created_at"],
    userField: "user_id",
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["user_id"],
    retentionClass: "account_lifecycle",
    redactionClass: "field_level",
    accessClass: "org_admin",
    deletionClass: "operator_review_required",
    exportMode: "include",
    deleteMode: "operator_review",
  },
  {
    dataClass: "organization",
    kind: "table",
    subjectScopes: ["organization"],
    table: "organizations",
    columns: ["id", "name", "mfa_required", "stripe_customer_id", "stripe_subscription_id", "stripe_subscription_status", "created_at"],
    organizationField: "id",
    containsPii: true,
    piiFields: ["name", "stripe_customer_id", "stripe_subscription_id"],
    retentionClass: "account_lifecycle",
    redactionClass: "field_level",
    accessClass: "org_admin",
    deletionClass: "operator_review_required",
    exportMode: "include",
    deleteMode: "operator_review",
  },
  {
    dataClass: "contracts",
    kind: "table",
    subjectScopes: ["organization", "contract"],
    table: "contracts",
    columns: ["id", "organization_id", "title", "counterparty", "contract_type", "status", "owner_id", "created_by", "created_at", "updated_at"],
    userField: "owner_id",
    organizationField: "organization_id",
    contractField: "id",
    containsPii: true,
    piiFields: ["title", "counterparty", "owner_id", "created_by"],
    retentionClass: "contract_lifecycle",
    redactionClass: "field_level",
    accessClass: "org_member",
    deletionClass: "legal_hold_guarded_delete",
    exportMode: "include",
    deleteMode: "legal_hold_guarded",
  },
  {
    dataClass: "contract_files",
    kind: "table",
    subjectScopes: ["organization", "contract", "user"],
    table: "contract_files",
    columns: ["id", "contract_id", "file_name", "file_type", "file_size", "storage_path", "uploaded_by", "created_at"],
    userField: "uploaded_by",
    contractField: "contract_id",
    containsPii: true,
    piiFields: ["file_name", "storage_path", "uploaded_by"],
    retentionClass: "contract_lifecycle",
    redactionClass: "field_level",
    accessClass: "org_member",
    deletionClass: "legal_hold_guarded_delete",
    exportMode: "include",
    deleteMode: "cascade_delete",
  },
  {
    dataClass: "contract_storage_objects",
    kind: "storage_bucket",
    subjectScopes: ["organization", "contract", "user"],
    storageBucket: "contracts",
    storagePathField: "contract_files.storage_path",
    containsPii: true,
    piiFields: ["object_name", "document_bytes"],
    retentionClass: "contract_lifecycle",
    redactionClass: "metadata_only",
    accessClass: "service_role_only",
    deletionClass: "legal_hold_guarded_delete",
    exportMode: "metadata_only",
    deleteMode: "cascade_delete",
  },
  {
    dataClass: "decision_packet_artifacts",
    kind: "storage_bucket",
    subjectScopes: ["organization", "contract"],
    storageBucket: "decision-packets",
    storagePathField: "decision_packet_runs.artifact_storage_path",
    containsPii: true,
    piiFields: ["artifact_storage_path", "artifact_pdf_storage_path", "packet_payload"],
    retentionClass: "contract_lifecycle",
    redactionClass: "metadata_only",
    accessClass: "service_role_only",
    deletionClass: "legal_hold_guarded_delete",
    exportMode: "metadata_only",
    deleteMode: "operator_review",
  },
  {
    dataClass: "extracted_fields",
    kind: "table",
    subjectScopes: ["organization", "contract"],
    table: "extracted_fields",
    columns: ["id", "contract_id", "field_key", "field_value", "confidence", "source_text", "created_at"],
    contractField: "contract_id",
    containsPii: true,
    piiFields: ["field_value", "source_text"],
    retentionClass: "contract_lifecycle",
    redactionClass: "field_level",
    accessClass: "org_member",
    deletionClass: "legal_hold_guarded_delete",
    exportMode: "include",
    deleteMode: "cascade_delete",
  },
  {
    dataClass: "contract_import_jobs",
    kind: "table",
    subjectScopes: ["organization", "user"],
    table: "contract_import_jobs",
    columns: ["id", "organization_id", "created_by", "status", "source", "created_at"],
    userField: "created_by",
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["created_by", "source"],
    retentionClass: "transient_30d",
    redactionClass: "metadata_only",
    accessClass: "org_admin",
    deletionClass: "operator_review_required",
    exportMode: "metadata_only",
    deleteMode: "operator_review",
  },
  {
    dataClass: "transient_import_rows",
    kind: "table",
    subjectScopes: ["organization"],
    table: "contract_import_job_rows",
    columns: ["id", "organization_id", "raw_payload", "normalized_fields", "retention_expires_at", "created_at"],
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["raw_payload", "normalized_fields"],
    retentionClass: "transient_30d",
    redactionClass: "metadata_only",
    accessClass: "service_role_only",
    deletionClass: "operator_review_required",
    exportMode: "count",
    deleteMode: "operator_review",
  },
  {
    dataClass: "extraction_artifacts",
    kind: "table",
    subjectScopes: ["organization", "contract"],
    table: "contract_extraction_jobs",
    columns: ["id", "contract_id", "status", "last_error", "retention_expires_at", "created_at"],
    contractField: "contract_id",
    containsPii: true,
    piiFields: ["last_error"],
    retentionClass: "transient_30d",
    redactionClass: "provider_failure_redacted",
    accessClass: "service_role_only",
    deletionClass: "operator_review_required",
    exportMode: "metadata_only",
    deleteMode: "operator_review",
  },
  {
    dataClass: "integration_tokens",
    kind: "table",
    subjectScopes: ["organization", "provider_account"],
    table: "integration_connections",
    columns: ["id", "organization_id", "provider", "access_token", "refresh_token", "token_key_id", "last_error", "updated_at"],
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["provider_account_id", "last_error"],
    retentionClass: "provider_operational",
    redactionClass: "hash_or_token_prefix_only",
    accessClass: "service_role_only",
    deletionClass: "revoke_token_then_redact",
    exportMode: "metadata_only",
    deleteMode: "revoke_and_redact",
  },
  {
    dataClass: "oauth_callback_state",
    kind: "table",
    subjectScopes: ["organization", "user"],
    table: "integration_oauth_states",
    columns: ["id", "organization_id", "user_id", "state", "code_verifier", "expires_at", "created_at"],
    userField: "user_id",
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["state", "code_verifier"],
    retentionClass: "transient_7d",
    redactionClass: "hash_or_token_prefix_only",
    accessClass: "service_role_only",
    deletionClass: "revoke_token_then_redact",
    exportMode: "count",
    deleteMode: "revoke_and_redact",
  },
  {
    dataClass: "external_action_links",
    kind: "table",
    subjectScopes: ["organization", "external_recipient"],
    table: "external_action_links",
    columns: ["id", "organization_id", "token_hash", "token_prefix", "email", "submitted_payload_json", "retention_expires_at"],
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["email", "submitted_payload_json", "token_prefix"],
    retentionClass: "transient_30d",
    redactionClass: "hash_or_token_prefix_only",
    accessClass: "service_role_only",
    deletionClass: "revoke_token_then_redact",
    exportMode: "metadata_only",
    deleteMode: "revoke_and_redact",
  },
  {
    dataClass: "report_tracking",
    kind: "table",
    subjectScopes: ["organization", "external_recipient"],
    table: "report_run_recipients",
    columns: ["id", "organization_id", "recipient_email", "engagement_token_hash", "engagement_token_prefix", "tracking_retention_expires_at"],
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["recipient_email", "engagement_token_prefix", "last_clicked_url"],
    retentionClass: "transient_180d",
    redactionClass: "hash_or_token_prefix_only",
    accessClass: "service_role_only",
    deletionClass: "revoke_token_then_redact",
    exportMode: "metadata_only",
    deleteMode: "revoke_and_redact",
  },
  {
    dataClass: "calendar_feed_tokens",
    kind: "table",
    subjectScopes: ["organization", "user"],
    table: "calendar_feeds",
    columns: ["id", "organization_id", "user_id", "token_hash", "token_prefix", "retention_expires_at"],
    userField: "user_id",
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["token_prefix"],
    retentionClass: "transient_30d",
    redactionClass: "hash_or_token_prefix_only",
    accessClass: "service_role_only",
    deletionClass: "revoke_token_then_redact",
    exportMode: "metadata_only",
    deleteMode: "revoke_and_redact",
  },
  {
    dataClass: "security_audit_events",
    kind: "table",
    subjectScopes: ["organization", "user"],
    table: "security_audit_events",
    columns: ["organization_id", "actor_user_id", "actor_type", "action", "target_type", "target_id", "safe_metadata", "created_at"],
    userField: "actor_user_id",
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["actor_user_id", "safe_metadata"],
    retentionClass: "audit_immutable",
    redactionClass: "metadata_only",
    accessClass: "service_role_only",
    deletionClass: "append_only_exempt",
    exportMode: "metadata_only",
    deleteMode: "not_applicable",
  },
  {
    dataClass: "v10_audit_events",
    kind: "table",
    subjectScopes: ["organization", "user"],
    table: "v10_audit_events",
    columns: ["audit_event_id", "organization_id", "actor_user_id", "actor_type", "action", "target_type", "target_id", "safe_metadata", "created_at"],
    userField: "actor_user_id",
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["actor_user_id", "safe_metadata"],
    retentionClass: "audit_immutable",
    redactionClass: "metadata_only",
    accessClass: "org_member",
    deletionClass: "append_only_exempt",
    exportMode: "metadata_only",
    deleteMode: "not_applicable",
  },
  {
    dataClass: "audit_events",
    kind: "table",
    subjectScopes: ["organization", "user", "contract"],
    table: "audit_events",
    columns: ["id", "organization_id", "actor_id", "action", "contract_id", "details", "created_at"],
    userField: "actor_id",
    organizationField: "organization_id",
    contractField: "contract_id",
    containsPii: true,
    piiFields: ["actor_id", "details"],
    retentionClass: "audit_immutable",
    redactionClass: "metadata_only",
    accessClass: "org_member",
    deletionClass: "append_only_exempt",
    exportMode: "metadata_only",
    deleteMode: "not_applicable",
  },
  {
    dataClass: "self_service_dsr_export",
    kind: "export_surface",
    subjectScopes: ["user", "organization"],
    exportSurface: "/api/me/export",
    containsPii: true,
    piiFields: ["profile", "membership", "organization", "audit_metadata"],
    retentionClass: "account_lifecycle",
    redactionClass: "metadata_only",
    accessClass: "self_service",
    deletionClass: "operator_review_required",
    exportMode: "include",
    deleteMode: "operator_review",
  },
  {
    dataClass: "contract_export_jobs",
    kind: "export_surface",
    subjectScopes: ["organization", "contract", "user"],
    table: "contract_export_jobs",
    columns: ["id", "organization_id", "created_by", "status", "download_token_hash", "created_at", "expires_at"],
    exportSurface: "/api/export/contracts",
    userField: "created_by",
    organizationField: "organization_id",
    containsPii: true,
    piiFields: ["download_token_hash", "query_snapshot", "created_by"],
    retentionClass: "transient_30d",
    redactionClass: "hash_or_token_prefix_only",
    accessClass: "org_member",
    deletionClass: "revoke_token_then_redact",
    exportMode: "metadata_only",
    deleteMode: "revoke_and_redact",
  },
  {
    dataClass: "audit_event_telemetry",
    kind: "telemetry_event",
    subjectScopes: ["organization", "user"],
    telemetryEvent: "audit_event.recorded",
    containsPii: true,
    piiFields: ["actor_user_id", "target_id", "safe_metadata"],
    retentionClass: "audit_immutable",
    redactionClass: "metadata_only",
    accessClass: "service_role_only",
    deletionClass: "append_only_exempt",
    exportMode: "metadata_only",
    deleteMode: "not_applicable",
  },
  {
    dataClass: "export_job_telemetry",
    kind: "telemetry_event",
    subjectScopes: ["organization", "user"],
    telemetryEvent: "export_job.completed",
    containsPii: true,
    piiFields: ["target_id", "safe_metadata"],
    retentionClass: "transient_30d",
    redactionClass: "metadata_only",
    accessClass: "service_role_only",
    deletionClass: "operator_review_required",
    exportMode: "metadata_only",
    deleteMode: "operator_review",
  },
  {
    dataClass: "stripe_billing_provider",
    kind: "provider",
    subjectScopes: ["organization", "provider_account"],
    provider: "stripe",
    providerFields: ["customer_id", "subscription_id", "checkout_session_id", "invoice_id"],
    containsPii: true,
    piiFields: ["customer_id", "subscription_id", "invoice_id"],
    retentionClass: "provider_operational",
    redactionClass: "provider_failure_redacted",
    accessClass: "provider_console_manual",
    deletionClass: "operator_review_required",
    exportMode: "metadata_only",
    deleteMode: "operator_review",
  },
  {
    dataClass: "resend_email_provider",
    kind: "provider",
    subjectScopes: ["organization", "external_recipient"],
    provider: "resend",
    providerFields: ["recipient_email", "message_id", "bounce_status"],
    containsPii: true,
    piiFields: ["recipient_email", "message_id"],
    retentionClass: "provider_operational",
    redactionClass: "provider_failure_redacted",
    accessClass: "provider_console_manual",
    deletionClass: "operator_review_required",
    exportMode: "metadata_only",
    deleteMode: "operator_review",
  },
  {
    dataClass: "openai_extraction_provider",
    kind: "provider",
    subjectScopes: ["organization", "contract"],
    provider: "openai",
    providerFields: ["contract_text", "field_candidates", "file_id"],
    containsPii: true,
    piiFields: ["contract_text", "field_candidates", "file_id"],
    retentionClass: "transient_30d",
    redactionClass: "provider_failure_redacted",
    accessClass: "provider_console_manual",
    deletionClass: "operator_review_required",
    exportMode: "metadata_only",
    deleteMode: "operator_review",
  },
];

export function isLegalHoldProfile(profile: unknown): boolean {
  return Boolean(profile && typeof profile === "object" && (profile as { legal_hold?: unknown }).legal_hold === true);
}

export function privacyInventoryTables(records: readonly PrivacyInventoryRecord[] = PRIVACY_SAFE_RECORD_INVENTORY): string[] {
  return [...new Set(records.map((record) => record.table).filter((table): table is string => Boolean(table)))].sort();
}

export function privacyInventoryByKind(
  kind: PrivacyInventoryKind,
  records: readonly PrivacyInventoryRecord[] = PRIVACY_SAFE_RECORD_INVENTORY
): PrivacyInventoryRecord[] {
  return records.filter((record) => record.kind === kind).sort((a, b) => a.dataClass.localeCompare(b.dataClass));
}

export function privacyInventoryClassificationIssues(
  records: readonly PrivacyInventoryRecord[] = PRIVACY_SAFE_RECORD_INVENTORY
): PrivacyClassificationIssue[] {
  const issues: PrivacyClassificationIssue[] = [];
  const dataClasses = new Set<string>();

  for (const record of records) {
    if (dataClasses.has(record.dataClass)) {
      issues.push({ dataClass: record.dataClass, issue: "duplicate_data_class" });
    }
    dataClasses.add(record.dataClass);

    if (record.containsPii || record.piiFields.length > 0) {
      for (const field of ["retentionClass", "redactionClass", "accessClass", "deletionClass"] as const) {
        if (!record[field]) {
          issues.push({ dataClass: record.dataClass, issue: "pii_record_missing_classification", field });
        }
      }
      if (record.piiFields.length === 0) {
        issues.push({ dataClass: record.dataClass, issue: "pii_record_missing_pii_fields" });
      }
    }

    if (record.kind === "table" && !record.table) {
      issues.push({ dataClass: record.dataClass, issue: "table_record_missing_table" });
    }
    if (record.kind === "storage_bucket" && !record.storageBucket) {
      issues.push({ dataClass: record.dataClass, issue: "storage_record_missing_bucket" });
    }
    if (record.kind === "telemetry_event" && !record.telemetryEvent) {
      issues.push({ dataClass: record.dataClass, issue: "telemetry_record_missing_event" });
    }
    if (record.kind === "export_surface" && !record.exportSurface) {
      issues.push({ dataClass: record.dataClass, issue: "export_record_missing_surface" });
    }
    if (record.kind === "provider" && !record.provider) {
      issues.push({ dataClass: record.dataClass, issue: "provider_record_missing_provider" });
    }
  }

  return issues.sort((a, b) => `${a.dataClass}:${a.issue}:${a.field ?? ""}`.localeCompare(`${b.dataClass}:${b.issue}:${b.field ?? ""}`));
}

export function privacyInventoryCoverageSummary(
  records: readonly PrivacyInventoryRecord[] = PRIVACY_SAFE_RECORD_INVENTORY
) {
  const byKind = records.reduce<Record<PrivacyInventoryKind, number>>(
    (acc, record) => {
      acc[record.kind] += 1;
      return acc;
    },
    {
      table: 0,
      storage_bucket: 0,
      telemetry_event: 0,
      export_surface: 0,
      provider: 0,
    }
  );
  return {
    schemaVersion: PRIVACY_INVENTORY_SCHEMA_VERSION,
    recordCount: records.length,
    piiRecordCount: records.filter((record) => record.containsPii || record.piiFields.length > 0).length,
    byKind,
    classificationIssueCount: privacyInventoryClassificationIssues(records).length,
  };
}

export function buildPrivacySafeUserExportPayload(input: {
  exportedAt: string;
  user: { id: string; email?: string | null };
  profile: unknown;
  organization: unknown;
  membership: { organization_id: string; role?: string | null };
}) {
  return {
    exported_at: input.exportedAt,
    schema_version: 1,
    inventory_version: PRIVACY_INVENTORY_SCHEMA_VERSION,
    inventory: PRIVACY_SAFE_RECORD_INVENTORY.map((record) => ({
      data_class: record.dataClass,
      kind: record.kind,
      table: record.table ?? null,
      storage_bucket: record.storageBucket ?? null,
      telemetry_event: record.telemetryEvent ?? null,
      export_surface: record.exportSurface ?? null,
      provider: record.provider ?? null,
      retention_class: record.retentionClass,
      redaction_class: record.redactionClass,
      access_class: record.accessClass,
      deletion_class: record.deletionClass,
      export_mode: record.exportMode,
      delete_mode: record.deleteMode,
    })),
    user: { id: input.user.id, email: input.user.email ?? null },
    profile: input.profile ?? null,
    organization: input.organization ?? null,
    membership: {
      organization_id: input.membership.organization_id,
      role: input.membership.role ?? null,
    },
  };
}
