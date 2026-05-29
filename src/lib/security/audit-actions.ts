export const API_AUDIT_ACTIONS = [
  "api.route_authorized",
  "api.sensitive_read_authorized",
  "api.mutation_authorized",
] as const;

export type ApiAuditAction = (typeof API_AUDIT_ACTIONS)[number];

export const SECURITY_AUDIT_ACTIONS = [
  "security.integration_api_key_created",
  "security.integration_api_key_policy_updated",
  "security.integration_api_key_revoked",
  "security.integration_disconnected",
  "security.integration_oauth_start_blocked",
  "security.integration_token_updated",
  "security.session_signed_out",
  "security.mfa_totp_verified",
  "security.mfa_totp_unenrolled",
  // SPEC: security-page-maximal-pass §1.34 — audit on enrollment start.
  "security.mfa_totp_enrollment_started",
  // SPEC: security-page-v4-pass.md §5.2 — resend email verification.
  "security.email_verification_resent",
  "security.org_mfa_required_updated",
  "security.sessions_revoke_others",
  "security.step_up_password_verified",
  "security.dsr_self_export_downloaded",
  "security.dsr_account_delete_requested",
  "security.dsr_self_export_blocked_legal_hold",
  "security.dsr_account_delete_blocked_legal_hold",
  "security.maintenance_destructive_action_blocked",
  "security.internal_debugging_sweep_success",
] as const;

export type SecurityAuditAction = (typeof SECURITY_AUDIT_ACTIONS)[number];

export type AuditActionFamily =
  | "activation"
  | "advanced"
  | "approval"
  | "artifact"
  | "assurance"
  | "attestations"
  | "audit"
  | "automation"
  | "billing"
  | "contract"
  | "contract_field"
  | "contract_file"
  | "contract_import"
  | "contracts"
  | "control_policy"
  | "crm"
  | "dashboard"
  | "decision"
  | "decision_packet_artifact"
  | "empty_state"
  | "evidence_link"
  | "evidence_request"
  | "exception"
  | "export"
  | "export_job"
  | "external_link"
  | "extraction"
  | "field"
  | "files"
  | "fixture"
  | "import"
  | "import_job"
  | "intake"
  | "integration"
  | "job"
  | "maintenance"
  | "member"
  | "mutation"
  | "note"
  | "notification"
  | "notification_preferences"
  | "notifications"
  | "obligation"
  | "onboarding"
  | "privacy_request"
  | "product"
  | "program"
  | "provider"
  | "read_model"
  | "record"
  | "relationship"
  | "release"
  | "release_evidence"
  | "release_fixture"
  | "renewal"
  | "renewal_checkpoint"
  | "report"
  | "report_pack"
  | "report_run"
  | "retention"
  | "rollout"
  | "runtime_artifact"
  | "saved_view"
  | "settings"
  | "support_diagnostic"
  | "task"
  | "v10_read_models"
  | "v5"
  | "work"
  | "work_item"
  | "workspace";

export type NamespacedAuditAction = `${AuditActionFamily}.${string}`;

export type AuditAction = ApiAuditAction | SecurityAuditAction | NamespacedAuditAction;
