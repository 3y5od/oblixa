import { sanitizeV10AuditMetadata, type V10AuditMetadata } from "@/lib/server-contracts";

export type AuditTimestampSource = "database_default_now" | "server_generated_iso";
export type AuditActorRequirement = "user" | "system" | "service";

export type SensitiveAuditPolicy = {
  id: string;
  actionPattern: RegExp;
  actor: AuditActorRequirement;
  targetTypes: string[];
  requiresOrganizationId: boolean;
  timestampSource: AuditTimestampSource;
  redaction: "safe_metadata_only";
  appendOnly: boolean;
};

export type AuditEventShape = {
  organization_id: string | null;
  actor_user_id: string | null;
  actor_type?: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: string;
  created_at?: string | null;
  safe_metadata?: V10AuditMetadata;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export const AUDIT_APPEND_ONLY_TABLES = [
  "audit_events",
  "v10_audit_events",
  "security_audit_events",
] as const;

export const SENSITIVE_AUDIT_EVENT_POLICIES: SensitiveAuditPolicy[] = [
  {
    id: "dsr-self-export",
    actionPattern: /^security\.dsr_self_export_(downloaded|blocked_legal_hold)$/u,
    actor: "user",
    targetTypes: ["user"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
  {
    id: "dsr-account-delete",
    actionPattern: /^security\.dsr_account_delete_(requested|blocked_legal_hold)$/u,
    actor: "user",
    targetTypes: ["user"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
  {
    id: "token-and-integration",
    actionPattern: /^security\.(integration_api_key_(created|policy_updated|revoked)|integration_token_updated|integration_oauth_start_blocked|integration_disconnected)$/u,
    actor: "user",
    targetTypes: ["integration_api_key", "integration_connection", "integration_oauth_state"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
  {
    id: "session-and-step-up",
    actionPattern: /^security\.(session_signed_out|sessions_revoke_others|step_up_password_verified|mfa_totp_(verified|unenrolled|enrollment_started))$/u,
    actor: "user",
    targetTypes: ["auth_session", "user"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
  {
    id: "import-export-report",
    actionPattern: /^(import_job|export_job|report_run)\./u,
    actor: "user",
    targetTypes: ["import_job", "export_job", "report_run"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
  {
    id: "external-action",
    actionPattern: /^(external|external_link|evidence_request)\./u,
    actor: "system",
    targetTypes: ["external_action", "evidence_request"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
  {
    id: "internal-service-role",
    actionPattern: /^security\.internal_debugging_sweep_success$/u,
    actor: "system",
    targetTypes: ["support_diagnostic"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
  {
    id: "privacy-lifecycle",
    actionPattern: /^privacy_request\./u,
    actor: "user",
    targetTypes: ["user", "organization", "contract_file", "report_run", "integration_connection"],
    requiresOrganizationId: true,
    timestampSource: "database_default_now",
    redaction: "safe_metadata_only",
    appendOnly: true,
  },
];

export function auditPolicyForAction(action: string): SensitiveAuditPolicy | null {
  return SENSITIVE_AUDIT_EVENT_POLICIES.find((policy) => policy.actionPattern.test(action)) ?? null;
}

export function validateAuditEventShape(event: AuditEventShape): string[] {
  const issues: string[] = [];
  const policy = auditPolicyForAction(event.action);
  if (!policy) issues.push("missing_sensitive_audit_policy");
  if (policy?.requiresOrganizationId && !event.organization_id) issues.push("organization_id_required");
  if (policy?.actor === "user" && !event.actor_user_id) issues.push("actor_user_id_required");
  if (policy && !policy.targetTypes.includes(event.target_type)) issues.push("target_type_not_allowed");
  if (!event.target_id) issues.push("target_id_required");
  if (!event.outcome) issues.push("outcome_required");
  if (event.updated_at) issues.push("audit_event_must_not_have_updated_at");
  if (event.deleted_at) issues.push("audit_event_must_not_have_deleted_at");
  if (
    event.safe_metadata &&
    JSON.stringify(sanitizeV10AuditMetadata(event.safe_metadata)) !== JSON.stringify(event.safe_metadata)
  ) {
    issues.push("safe_metadata_must_be_sanitized");
  }
  return issues.sort();
}

export function auditEventPolicyCoverageIssues(
  policies: readonly SensitiveAuditPolicy[] = SENSITIVE_AUDIT_EVENT_POLICIES
): string[] {
  const issues: string[] = [];
  const requiredIds = [
    "dsr-self-export",
    "dsr-account-delete",
    "token-and-integration",
    "session-and-step-up",
    "import-export-report",
    "external-action",
    "internal-service-role",
    "privacy-lifecycle",
  ];

  for (const id of requiredIds) {
    if (!policies.some((policy) => policy.id === id)) issues.push(`${id}:missing_policy`);
  }
  for (const table of AUDIT_APPEND_ONLY_TABLES) {
    if (!table.includes("audit")) issues.push(`${table}:not_audit_table`);
  }
  for (const policy of policies) {
    if (!policy.appendOnly) issues.push(`${policy.id}:append_only_required`);
    if (policy.redaction !== "safe_metadata_only") issues.push(`${policy.id}:safe_metadata_redaction_required`);
    if (policy.timestampSource !== "database_default_now") issues.push(`${policy.id}:database_timestamp_required`);
    if (policy.requiresOrganizationId !== true) issues.push(`${policy.id}:organization_required`);
  }
  return issues.sort();
}
