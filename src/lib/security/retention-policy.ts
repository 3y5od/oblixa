export type RetentionCleanupStrategy =
  | "delete_expired"
  | "redact_fields"
  | "revoke_and_redact_token"
  | "minimize_payload";

export type RetentionPolicy = {
  dataClass: string;
  table: string;
  timestampField: string;
  retentionDays: number;
  strategy: RetentionCleanupStrategy;
  cleanupRpc: "cleanup_code_owned_transient_data";
  fields?: string[];
};

export const CODE_OWNED_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    dataClass: "import_raw_payloads",
    table: "contract_import_job_rows",
    timestampField: "retention_expires_at",
    retentionDays: 30,
    strategy: "minimize_payload",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["raw_payload"],
  },
  {
    dataClass: "extraction_artifacts",
    table: "contract_extraction_jobs",
    timestampField: "retention_expires_at",
    retentionDays: 30,
    strategy: "redact_fields",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["last_error"],
  },
  {
    dataClass: "report_tracking",
    table: "report_run_recipients",
    timestampField: "tracking_retention_expires_at",
    retentionDays: 180,
    strategy: "revoke_and_redact_token",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["last_clicked_url", "engagement_token_hash", "engagement_token_prefix"],
  },
  {
    dataClass: "expired_public_tokens",
    table: "external_action_links",
    timestampField: "retention_expires_at",
    retentionDays: 30,
    strategy: "revoke_and_redact_token",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["token_hash", "token_prefix", "submitted_payload_json"],
  },
  {
    dataClass: "calendar_feed_tokens",
    table: "calendar_feeds",
    timestampField: "retention_expires_at",
    retentionDays: 30,
    strategy: "revoke_and_redact_token",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["token_hash", "token_prefix"],
  },
  {
    dataClass: "oauth_callback_state",
    table: "integration_oauth_states",
    timestampField: "expires_at",
    retentionDays: 7,
    strategy: "delete_expired",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["state", "code_verifier"],
  },
  {
    dataClass: "stale_audit_adjacent_payloads",
    table: "external_action_events",
    timestampField: "created_at",
    retentionDays: 365,
    strategy: "redact_fields",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["payload_json"],
  },
];

export function retentionPolicyByDataClass(dataClass: string): RetentionPolicy | null {
  return CODE_OWNED_RETENTION_POLICIES.find((policy) => policy.dataClass === dataClass) ?? null;
}

export function retentionPolicyTables(): string[] {
  return [...new Set(CODE_OWNED_RETENTION_POLICIES.map((policy) => policy.table))].sort();
}
