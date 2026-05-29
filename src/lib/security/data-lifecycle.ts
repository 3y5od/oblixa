export type LifecycleScope =
  | "organization_deletion"
  | "user_deletion"
  | "token_revocation"
  | "upload_deletion"
  | "report_deletion"
  | "legal_hold_exception";

export type LifecycleStepKind =
  | "audit"
  | "delete_rows"
  | "delete_storage"
  | "redact_fields"
  | "revoke_token"
  | "preserve_append_only"
  | "operator_review";

export type LifecycleCascadeStep = {
  id: string;
  kind: LifecycleStepKind;
  target: string;
  guard: string;
  auditAction: string;
  localOnly: boolean;
};

export type LifecycleCascadePlan = {
  scope: LifecycleScope;
  objective: string;
  legalHoldBehavior: "block" | "preserve_append_only" | "not_applicable";
  requiredAuditAction: string;
  steps: LifecycleCascadeStep[];
};

export type PlannedLifecycleCascade = {
  scope: LifecycleScope;
  targetId: string;
  blocked: boolean;
  blockReason: string | null;
  requiredAuditAction: string;
  steps: LifecycleCascadeStep[];
};

export const DATA_LIFECYCLE_CASCADE_PLANS: LifecycleCascadePlan[] = [
  {
    scope: "organization_deletion",
    objective: "Delete or detach organization-owned product data while preserving append-only audit history.",
    legalHoldBehavior: "block",
    requiredAuditAction: "privacy_request.organization_delete_requested",
    steps: [
      {
        id: "org-audit-start",
        kind: "audit",
        target: "v10_audit_events",
        guard: "record deletion request before mutation after legal hold check",
        auditAction: "privacy_request.organization_delete_requested",
        localOnly: true,
      },
      {
        id: "org-revoke-provider-tokens",
        kind: "revoke_token",
        target: "integration_connections, integration_api_keys, calendar_feeds, external_action_links",
        guard: "revoke before row deletion or redaction",
        auditAction: "privacy_request.organization_tokens_revoked",
        localOnly: true,
      },
      {
        id: "org-delete-product-rows",
        kind: "delete_rows",
        target: "contracts, extracted_fields, contract_files, reminders, saved_views",
        guard: "organization_id scoped predicate only",
        auditAction: "privacy_request.organization_product_rows_deleted",
        localOnly: true,
      },
      {
        id: "org-delete-storage",
        kind: "delete_storage",
        target: "contracts bucket and decision-packets bucket",
        guard: "storage path must start with organization id",
        auditAction: "privacy_request.organization_storage_deleted",
        localOnly: true,
      },
      {
        id: "org-preserve-audit",
        kind: "preserve_append_only",
        target: "audit_events, v10_audit_events, security_audit_events",
        guard: "append-only audit tables are never updated or deleted in cascade",
        auditAction: "privacy_request.organization_audit_preserved",
        localOnly: true,
      },
    ],
  },
  {
    scope: "user_deletion",
    objective: "Delete or minimize user-linked profile and membership data after step-up and legal-hold checks.",
    legalHoldBehavior: "block",
    requiredAuditAction: "security.dsr_account_delete_requested",
    steps: [
      {
        id: "user-audit-start",
        kind: "audit",
        target: "v10_audit_events",
        guard: "strict audit write before acknowledging deletion request",
        auditAction: "security.dsr_account_delete_requested",
        localOnly: true,
      },
      {
        id: "user-redact-profile",
        kind: "redact_fields",
        target: "profiles.full_name",
        guard: "profiles.legal_hold must be false",
        auditAction: "privacy_request.user_profile_redacted",
        localOnly: true,
      },
      {
        id: "user-detach-memberships",
        kind: "operator_review",
        target: "organization_members",
        guard: "preserve org continuity and ownership transfer review",
        auditAction: "privacy_request.user_membership_reviewed",
        localOnly: true,
      },
      {
        id: "user-revoke-public-tokens",
        kind: "revoke_token",
        target: "calendar_feeds, report_run_recipients, external_action_links",
        guard: "hash/token prefix only retained after revocation",
        auditAction: "privacy_request.user_tokens_revoked",
        localOnly: true,
      },
    ],
  },
  {
    scope: "token_revocation",
    objective: "Revoke and redact integration, public-link, report, and calendar tokens.",
    legalHoldBehavior: "not_applicable",
    requiredAuditAction: "security.integration_api_key_revoked",
    steps: [
      {
        id: "token-audit-start",
        kind: "audit",
        target: "v10_audit_events",
        guard: "strict audit write before token material changes",
        auditAction: "security.integration_api_key_revoked",
        localOnly: true,
      },
      {
        id: "token-redact-secret-material",
        kind: "redact_fields",
        target: "integration_connections.access_token, integration_connections.refresh_token",
        guard: "encrypted token material removed or re-encrypted by active key id",
        auditAction: "privacy_request.integration_token_redacted",
        localOnly: true,
      },
      {
        id: "token-delete-oauth-state",
        kind: "delete_rows",
        target: "integration_oauth_states",
        guard: "expired or consumed state only",
        auditAction: "privacy_request.oauth_state_deleted",
        localOnly: true,
      },
    ],
  },
  {
    scope: "upload_deletion",
    objective: "Delete upload rows, parser artifacts, and storage objects with contract/org scoping.",
    legalHoldBehavior: "block",
    requiredAuditAction: "privacy_request.upload_delete_requested",
    steps: [
      {
        id: "upload-audit-start",
        kind: "audit",
        target: "v10_audit_events",
        guard: "audit before storage deletion after legal hold check",
        auditAction: "privacy_request.upload_delete_requested",
        localOnly: true,
      },
      {
        id: "upload-delete-storage-object",
        kind: "delete_storage",
        target: "storage.objects contracts bucket",
        guard: "contract_files.storage_path must match contract org scope",
        auditAction: "privacy_request.upload_storage_deleted",
        localOnly: true,
      },
      {
        id: "upload-delete-file-row",
        kind: "delete_rows",
        target: "contract_files",
        guard: "contract_id and organization membership verified",
        auditAction: "privacy_request.upload_row_deleted",
        localOnly: true,
      },
      {
        id: "upload-redact-parser-state",
        kind: "redact_fields",
        target: "contract_extraction_jobs.last_error",
        guard: "retention_expires_at cleanup path",
        auditAction: "privacy_request.upload_parser_state_redacted",
        localOnly: true,
      },
    ],
  },
  {
    scope: "report_deletion",
    objective: "Remove generated report/export artifacts and revoke download tracking tokens.",
    legalHoldBehavior: "preserve_append_only",
    requiredAuditAction: "privacy_request.report_delete_requested",
    steps: [
      {
        id: "report-audit-start",
        kind: "audit",
        target: "v10_audit_events",
        guard: "audit before export job or artifact revocation",
        auditAction: "privacy_request.report_delete_requested",
        localOnly: true,
      },
      {
        id: "report-revoke-download-tokens",
        kind: "revoke_token",
        target: "contract_export_jobs, report_run_recipients",
        guard: "token hash/prefix only retained",
        auditAction: "privacy_request.report_tokens_revoked",
        localOnly: true,
      },
      {
        id: "report-delete-artifacts",
        kind: "delete_storage",
        target: "decision_packet_runs artifact paths",
        guard: "artifact path must be org/run scoped",
        auditAction: "privacy_request.report_artifacts_deleted",
        localOnly: true,
      },
    ],
  },
  {
    scope: "legal_hold_exception",
    objective: "Block destructive privacy actions while documenting the append-only legal-hold exception.",
    legalHoldBehavior: "preserve_append_only",
    requiredAuditAction: "security.dsr_account_delete_blocked_legal_hold",
    steps: [
      {
        id: "legal-hold-audit",
        kind: "audit",
        target: "v10_audit_events",
        guard: "write blocked-deletion audit event",
        auditAction: "security.dsr_account_delete_blocked_legal_hold",
        localOnly: true,
      },
      {
        id: "legal-hold-preserve",
        kind: "preserve_append_only",
        target: "profiles, audit_events, v10_audit_events",
        guard: "no destructive changes while legal hold is active",
        auditAction: "privacy_request.legal_hold_preserved",
        localOnly: true,
      },
    ],
  },
];

export function planLifecycleCascade(input: {
  scope: LifecycleScope;
  targetId: string;
  legalHold: boolean;
}): PlannedLifecycleCascade {
  const plan = DATA_LIFECYCLE_CASCADE_PLANS.find((candidate) => candidate.scope === input.scope);
  if (!plan) {
    throw new Error(`Unknown lifecycle cascade scope: ${input.scope}`);
  }

  const blocked = input.legalHold && plan.legalHoldBehavior === "block";
  return {
    scope: plan.scope,
    targetId: input.targetId,
    blocked,
    blockReason: blocked ? "legal_hold_active" : null,
    requiredAuditAction: plan.requiredAuditAction,
    steps: blocked
      ? plan.steps.filter((step) => step.kind === "audit" || step.kind === "preserve_append_only")
      : plan.steps,
  };
}

export function lifecycleCascadePlanIssues(
  plans: readonly LifecycleCascadePlan[] = DATA_LIFECYCLE_CASCADE_PLANS
): string[] {
  const issues: string[] = [];
  const requiredScopes: LifecycleScope[] = [
    "organization_deletion",
    "user_deletion",
    "token_revocation",
    "upload_deletion",
    "report_deletion",
    "legal_hold_exception",
  ];

  for (const scope of requiredScopes) {
    if (!plans.some((plan) => plan.scope === scope)) issues.push(`${scope}:missing_plan`);
  }

  for (const plan of plans) {
    if (!plan.requiredAuditAction.includes(".")) issues.push(`${plan.scope}:missing_namespaced_audit_action`);
    if (!plan.steps.some((step) => step.kind === "audit")) issues.push(`${plan.scope}:missing_audit_step`);
    if (plan.legalHoldBehavior === "block" && !plan.steps.some((step) => step.guard.includes("legal") || step.guard.includes("Legal"))) {
      issues.push(`${plan.scope}:missing_legal_hold_guard`);
    }
    for (const step of plan.steps) {
      if (!step.auditAction.includes(".")) issues.push(`${plan.scope}:${step.id}:missing_audit_action`);
      if (!step.localOnly) issues.push(`${plan.scope}:${step.id}:external_side_effect_not_marked_manual`);
    }
  }

  return issues.sort();
}
