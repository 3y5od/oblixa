import {
  V10_ACTIVATION_STATES,
  V10_JOB_STATUSES,
  V10_WORK_ITEM_STATUSES,
} from "./v10-release-contract";

export type V10OperationalDomain =
  | "jobs"
  | "mutations"
  | "empty_states"
  | "hidden_features"
  | "external_links"
  | "reports"
  | "exports"
  | "read_models"
  | "audit"
  | "telemetry"
  | "search"
  | "activation"
  | "renewal"
  | "evidence"
  | "automation"
  | "settings";

export type V10FailureRecoveryContract = {
  domain: V10OperationalDomain;
  failureState: string;
  userVisibleState: string;
  recoveryAction: string;
  diagnosticRequired: boolean;
  auditRequired: boolean;
};

export const V10_FAILURE_RECOVERY_MATRIX: readonly V10FailureRecoveryContract[] = [
  {
    domain: "jobs",
    failureState: "failed_retryable",
    userVisibleState: "failed_with_retry",
    recoveryAction: "retry_same_scope",
    diagnosticRequired: true,
    auditRequired: true,
  },
  {
    domain: "jobs",
    failureState: "failed_terminal",
    userVisibleState: "failed_contact_support",
    recoveryAction: "open_support_safe_diagnostics",
    diagnosticRequired: true,
    auditRequired: true,
  },
  {
    domain: "mutations",
    failureState: "stale_version",
    userVisibleState: "record_changed",
    recoveryAction: "refresh_and_reapply",
    diagnosticRequired: true,
    auditRequired: false,
  },
  {
    domain: "empty_states",
    failureState: "no_records",
    userVisibleState: "guided_empty_state",
    recoveryAction: "show_next_activation_or_filter_action",
    diagnosticRequired: false,
    auditRequired: false,
  },
  {
    domain: "hidden_features",
    failureState: "module_hidden",
    userVisibleState: "feature_hidden_by_admin",
    recoveryAction: "link_to_settings_when_allowed",
    diagnosticRequired: false,
    auditRequired: false,
  },
  {
    domain: "external_links",
    failureState: "expired_or_revoked",
    userVisibleState: "external_link_unavailable",
    recoveryAction: "request_new_link_from_workspace_owner",
    diagnosticRequired: true,
    auditRequired: true,
  },
  {
    domain: "reports",
    failureState: "async_threshold_exceeded",
    userVisibleState: "report_queued",
    recoveryAction: "show_job_visibility_and_notification_path",
    diagnosticRequired: true,
    auditRequired: true,
  },
  {
    domain: "exports",
    failureState: "unsafe_csv_value",
    userVisibleState: "export_sanitized",
    recoveryAction: "neutralize_formula_and_log_sanitization_count",
    diagnosticRequired: true,
    auditRequired: true,
  },
] as const;

export type V10StateMachineContract = {
  name: string;
  states: readonly string[];
  terminalStates: readonly string[];
  auditTransitions: readonly string[];
  actionAvailability: Record<string, readonly string[]>;
  noActionExplanations: Record<string, string>;
  rollbackTransitions: readonly string[];
};

export const V10_STATE_MACHINES: readonly V10StateMachineContract[] = [
  {
    name: "activation",
    states: V10_ACTIVATION_STATES,
    terminalStates: ["dashboard_updated", "extraction_failed"],
    auditTransitions: [
      "workspace_prepared->contract_uploaded_or_imported",
      "contract_uploaded_or_imported->extraction_queued",
      "extraction_queued->extraction_running",
      "extraction_running->extraction_partially_complete",
      "extraction_running->extraction_failed",
      "extraction_running->required_field_review_ready",
      "required_field_review_ready->required_fields_approved",
      "required_fields_approved->owner_assigned",
      "owner_assigned->first_work_item_generated",
      "first_work_item_generated->dashboard_updated",
    ],
    actionAvailability: {
      extraction_failed: ["retry_failed_job"],
      required_field_review_ready: ["open_source_object"],
      dashboard_updated: [],
    },
    noActionExplanations: {
      dashboard_updated: "Activation is complete and no activation action is waiting.",
      extraction_failed: "Activation could not finish until extraction is retried or the source file is replaced.",
    },
    rollbackTransitions: ["extraction_failed->extraction_queued"],
  },
  {
    name: "work_item",
    states: V10_WORK_ITEM_STATUSES,
    terminalStates: ["done", "canceled"],
    auditTransitions: ["open->in_progress", "blocked->in_progress", "waiting->in_progress", "in_progress->done", "open->done", "open->canceled"],
    actionAvailability: {
      open: ["open_source_object", "mark_done", "assign_owner"],
      blocked: ["open_source_object"],
      done: [],
      canceled: [],
    },
    noActionExplanations: {
      done: "This work item is complete.",
      canceled: "This work item was canceled and cannot be changed from the inbox.",
    },
    rollbackTransitions: ["done->open", "canceled->open"],
  },
  {
    name: "evidence_request",
    states: ["draft", "sent", "opened", "submitted", "accepted", "rejected", "expired"],
    terminalStates: ["accepted", "expired"],
    auditTransitions: ["sent->submitted", "submitted->accepted", "submitted->rejected"],
    actionAvailability: {
      sent: ["copy_external_link"],
      submitted: ["accept_evidence", "reject_evidence"],
      rejected: ["copy_external_link"],
      accepted: [],
      expired: [],
    },
    noActionExplanations: {
      accepted: "Evidence has been accepted.",
      expired: "This evidence link expired. Request a fresh link from the workspace owner.",
    },
    rollbackTransitions: ["rejected->sent"],
  },
  {
    name: "approval",
    states: ["pending", "approved", "rejected", "canceled", "expired"],
    terminalStates: ["approved", "rejected", "canceled", "expired"],
    auditTransitions: ["pending->approved", "pending->rejected", "pending->canceled"],
    actionAvailability: {
      pending: ["approve_approval", "reject_approval"],
      approved: [],
      rejected: [],
      canceled: [],
      expired: [],
    },
    noActionExplanations: {
      approved: "This approval is already approved.",
      rejected: "This approval was rejected.",
      canceled: "This approval was canceled.",
      expired: "This approval expired before action.",
    },
    rollbackTransitions: ["pending->canceled"],
  },
  {
    name: "job",
    states: V10_JOB_STATUSES,
    terminalStates: ["succeeded", "failed_terminal", "canceled"],
    auditTransitions: ["queued->running", "running->succeeded", "running->failed_retryable", "running->failed_terminal", "failed_retryable->retrying"],
    actionAvailability: {
      failed_retryable: ["retry_failed_job"],
      partial: ["retry_failed_job"],
      queued: ["cancel_job"],
      running: ["cancel_job"],
      succeeded: [],
      failed_terminal: [],
      canceled: [],
    },
    noActionExplanations: {
      succeeded: "This job completed successfully.",
      failed_terminal: "This job cannot be retried automatically. Review support-safe diagnostics.",
      canceled: "This job was canceled.",
    },
    rollbackTransitions: ["failed_retryable->retrying", "partial->retrying"],
  },
] as const;

export type V10StaticContract = {
  key: string;
  requirements: readonly string[];
};

export const V10_SOURCE_OBJECT_TAXONOMY: readonly V10StaticContract[] = [
  { key: "contract", requirements: ["canonical_source", "source_hash", "provenance_state", "audit_event_ids"] },
  { key: "work_item", requirements: ["source_object_type", "source_object_id", "dedupe_key", "lifecycle_state"] },
  { key: "report_run", requirements: ["source_filter_hash", "job_id", "generated_artifact_id", "retention_policy"] },
  { key: "external_link", requirements: ["scoped_token_hash", "expires_at", "revoked_at", "consent_state"] },
  { key: "automation_run", requirements: ["approval_id", "revert_action", "result_state", "not_reversible_warning"] },
] as const;

export const V10_DB_RLS_CONTRACTS: readonly V10StaticContract[] = [
  { key: "tenant_isolation", requirements: ["organization_id_required", "cross_org_negative_tests", "service_role_scoped_by_job"] },
  { key: "read_models", requirements: ["derived_server_side", "no_client_writes", "workspace_mode_filtered", "module_visibility_filtered"] },
  { key: "external_links", requirements: ["token_hash_only", "single_scope_access", "no_workspace_browse", "revocation_checked"] },
  { key: "artifacts", requirements: ["signed_url_short_ttl", "download_audit", "private_cache_headers", "retention_expiry"] },
] as const;

export const V10_EDGE_CASE_MATRIX: readonly V10StaticContract[] = [
  { key: "time", requirements: ["workspace_timezone", "business_day_calendar", "sla_due_window", "renewal_horizon_boundaries", "dst_transition", "date_only_vs_timestamp"] },
  { key: "concurrency", requirements: ["simultaneous_owner_assignment", "field_approval_race", "idempotency_replay", "read_model_refresh_race", "settings_role_change_race"] },
  { key: "multi_tab", requirements: ["double_submit", "stale_cached_data", "back_forward_navigation", "optimistic_rollback", "focus_preservation"] },
  { key: "multi_org", requirements: ["org_switch", "removed_member", "role_downgrade_during_mutation", "cross_org_saved_link", "plan_downgrade_during_mutation"] },
  { key: "offline", requirements: ["offline_retry", "aborted_request", "slow_network", "reconnect_replay", "queued_mutation_copy"] },
  { key: "locale", requirements: ["en_us_date_copy", "en_gb_date_copy", "currency_format", "timezone_display", "collation_safe_search"] },
  { key: "browser", requirements: ["chromium", "webkit", "firefox", "mobile_viewport", "reduced_motion", "screen_reader_keyboard"] },
  { key: "large_data", requirements: ["ten_thousand_contracts", "fifty_thousand_export_rows", "large_audit_trail", "large_command_search_result", "many_work_items"] },
  { key: "money", requirements: ["currency_presence", "threshold_currency_match", "large_value_sorting", "missing_value_explanation"] },
  { key: "scale", requirements: ["pagination", "virtualization", "async_job_handoff", "payload_size_budget"] },
  { key: "duplicates", requirements: ["import_duplicate_detection", "generated_work_dedupe", "source_hash_conflict", "row_correction_linkage"] },
  { key: "ownership", requirements: ["stale_owner", "team_owner", "unassigned", "role_removed"] },
] as const;

export const V10_ROLLOUT_RATCHETS: readonly V10StaticContract[] = [
  { key: "feature_flags", requirements: ["additive_only", "default_hidden_for_unreleased", "kill_switch_documented"] },
  { key: "ci_ratchets", requirements: ["v10_suite_required", "existing_v8_v9_gates_preserved", "release_evidence_freshness_check"] },
  { key: "change_control", requirements: ["freeze_window", "evidence_invalidation", "decision_log", "post_implementation_review"] },
] as const;

export const V10_TEST_TIERS: readonly V10StaticContract[] = [
  { key: "fast_unit", requirements: ["contract_constants", "semantic_helpers", "state_machines", "deterministic_oracles"] },
  { key: "focused_integration", requirements: ["actions", "routes", "rls_boundaries", "report_export_jobs"] },
  { key: "browser", requirements: ["activation", "work_reachability", "command_search", "settings_governance", "accessibility"] },
  { key: "release_candidate", requirements: ["fixtures", "objective_metrics", "dashboard_evidence", "synthetic_monitoring"] },
  { key: "post_ga", requirements: ["alert_review", "evidence_archival", "rollback_drill", "support_diagnostics"] },
] as const;

export type V10TestTierExecutionContract = {
  tier:
    | "fast_unit"
    | "focused_integration"
    | "ui_component"
    | "browser_e2e"
    | "static_release"
    | "release_candidate"
    | "external_blocker";
  command: string;
  owner: "engineering" | "product" | "security" | "support" | "release";
  ciBlocking: boolean;
  freshnessHours: number;
  covers: readonly string[];
  skipPolicy: "no_skips" | "skip_requires_reason" | "external_evidence_required";
};

export const V10_TEST_TIER_EXECUTION_CONTRACTS: readonly V10TestTierExecutionContract[] = [
  {
    tier: "fast_unit",
    command: "npm run test:logic",
    owner: "engineering",
    ciBlocking: true,
    freshnessHours: 24,
    covers: ["contract_constants", "semantic_helpers", "state_machines", "deterministic_oracles"],
    skipPolicy: "no_skips",
  },
  {
    tier: "focused_integration",
    command: "npm run check:v10-suite",
    owner: "engineering",
    ciBlocking: true,
    freshnessHours: 24,
    covers: ["actions", "routes", "rls_boundaries", "report_export_jobs", "cron"],
    skipPolicy: "no_skips",
  },
  {
    tier: "ui_component",
    command: "npm run test:ui",
    owner: "engineering",
    ciBlocking: true,
    freshnessHours: 24,
    covers: ["recoverable_states", "a11y_smoke", "keyboard_focus", "responsive_states"],
    skipPolicy: "skip_requires_reason",
  },
  {
    tier: "browser_e2e",
    command: "npm run test:e2e:v10",
    owner: "product",
    ciBlocking: true,
    freshnessHours: 24,
    covers: ["activation", "work_reachability", "command_search", "settings_governance", "accessibility"],
    skipPolicy: "skip_requires_reason",
  },
  {
    tier: "static_release",
    command: "npm run check:v10-release-evidence",
    owner: "release",
    ciBlocking: true,
    freshnessHours: 24,
    covers: ["release_evidence", "privacy_scan", "semgrep", "ci_tokens"],
    skipPolicy: "no_skips",
  },
  {
    tier: "release_candidate",
    command: "npm run check:v10-release-evidence -- --metric all",
    owner: "release",
    ciBlocking: true,
    freshnessHours: 24,
    covers: ["fixtures", "objective_metrics", "dashboard_evidence", "synthetic_monitoring"],
    skipPolicy: "external_evidence_required",
  },
  {
    tier: "external_blocker",
    command: "npm run check:v10-release-evidence -- --external-blockers",
    owner: "release",
    ciBlocking: true,
    freshnessHours: 24,
    covers: ["human_usability_study", "provider_configuration", "canary_review", "support_readiness"],
    skipPolicy: "external_evidence_required",
  },
] as const;

export const V10_DIAGNOSTIC_CONTRACTS: readonly V10StaticContract[] = [
  { key: "diagnostic_ids", requirements: ["created_for_jobs_mutations_exports_reports", "support_safe", "correlates_audit_telemetry_logs"] },
  { key: "logging", requirements: ["no_pii_payloads", "no_raw_contract_text", "no_tokens", "redacted_provider_errors"] },
  { key: "observability", requirements: ["slo_keys", "dashboard_freshness", "canary_checks", "incident_escalation"] },
] as const;

export const V10_BOUNDARY_CONTRACTS: readonly V10StaticContract[] = [
  { key: "client_server", requirements: ["service_role_server_only", "private_env_server_only", "no_sensitive_bundle_literals", "cache_tags_documented"] },
  { key: "files", requirements: ["csv_formula_neutralization", "malware_scan_gate", "signed_downloads", "artifact_retention"] },
  { key: "integrations", requirements: ["provider_outage_state", "webhook_signature", "slack_email_privacy", "calendar_timezone"] },
  { key: "ai_extraction", requirements: ["prompt_injection_boundary", "provider_data_minimization", "parser_confidence", "human_review_queue"] },
] as const;

export const V10_DATA_CLASSIFICATION_CONTRACTS: readonly V10StaticContract[] = [
  { key: "client_safe", requirements: ["visible_ids", "visible_titles", "status_labels", "counts", "diagnostic_ids"] },
  { key: "server_safe", requirements: ["source_metadata", "private_ids", "provider_categories", "retry_metadata", "eligibility_reasons"] },
  { key: "audit_safe", requirements: ["actor", "target", "mutation", "outcome", "support_safe_metadata"] },
  { key: "telemetry_safe", requirements: ["metric_key", "duration_bucket", "count", "feature_family", "diagnostic_id"] },
  { key: "export_safe", requirements: ["visible_selected_fields", "csv_formula_neutralized", "redaction_rule", "audit_event_id"] },
  { key: "diagnostic_safe", requirements: ["diagnostic_id", "failure_category", "retry_eligibility", "support_safe_detail", "remediation_link"] },
  { key: "prohibited", requirements: ["raw_contract_text", "secrets", "signed_link_tokens", "provider_credentials", "hidden_record_details"] },
] as const;

export const V10_LIFECYCLE_RETENTION_CONTRACTS: readonly V10StaticContract[] = [
  { key: "archive", requirements: ["visibility_state_archived", "audit_history_preserved", "reports_history_allowed", "active_work_suppressed"] },
  { key: "delete", requirements: ["source_delete_scoped", "read_models_hidden", "exports_retention_checked", "audit_retention_preserved"] },
  { key: "restore", requirements: ["role_required", "source_visibility_restored", "read_model_refresh_required", "audit_event_required"] },
  { key: "legal_hold", requirements: ["delete_blocked", "export_redaction_preserved", "audit_retention_extended", "release_evidence_not_private"] },
  { key: "external_evidence", requirements: ["link_expiry", "revocation", "submission_retention", "responder_identity_redaction"] },
  { key: "release_evidence", requirements: ["owner", "freshness_window", "expiry", "validation_metadata", "non_customer_content"] },
] as const;

export const V10_ENVIRONMENT_CONFIG_CONTRACTS: readonly V10StaticContract[] = [
  { key: "cron_auth", requirements: ["secret_present", "service_actor", "scoped_org_iteration", "failure_isolation"] },
  { key: "providers", requirements: ["email_config", "storage_config", "ai_provider_config", "provider_outage_state"] },
  { key: "playwright", requirements: ["base_url", "credentials_or_skip_reason", "v10_tag", "no_real_customer_fixture"] },
  { key: "public_private_config", requirements: ["public_prefix_only_for_client", "server_secrets_not_bundled", "signed_url_ttl_configured"] },
  { key: "config_drift", requirements: ["required_key_inventory", "environment_parity_check", "release_evidence_blocker"] },
] as const;

export const V10_NOTIFICATION_COMPLIANCE_CONTRACTS: readonly V10StaticContract[] = [
  { key: "consent", requirements: ["workspace_preference", "user_preference", "channel_eligibility", "unsubscribe_respected"] },
  { key: "suppression", requirements: ["hidden_module_suppressed", "revoked_external_link_suppressed", "quiet_hours", "incident_circuit_breaker"] },
  { key: "external_recipient", requirements: ["signed_scope_only", "no_workspace_browse", "safe_subject", "audit_delivery"] },
  { key: "escalation", requirements: ["owner_notification_first", "manager_escalation_after_window", "dedupe_key", "work_item_link"] },
] as const;

export const V10_ARTIFACT_CONTRACTS: readonly V10StaticContract[] = [
  { key: "reports", requirements: ["owner", "organization_scope", "redaction_rule", "retention_policy", "delivery_audit"] },
  { key: "exports", requirements: ["selected_rows", "csv_formula_safety", "artifact_access_scope", "expiry", "download_audit"] },
  { key: "evidence_files", requirements: ["request_scope", "malware_scan_state", "external_link_scope", "review_state", "retention_policy"] },
  { key: "release_bundles", requirements: ["synthetic_only", "checksum", "owner_signoff", "freshness_window", "blocker_status"] },
  { key: "screenshots_traces", requirements: ["no_private_text", "fixture_classification", "browser_context", "expiry"] },
  { key: "generated_fixtures", requirements: ["synthetic_classification", "stable_denominator", "seed_manifest", "rebuild_command"] },
] as const;

export const V10_READINESS_AUDIENCES: readonly V10StaticContract[] = [
  { key: "engineering", requirements: ["implementation_audit", "dependency_graph", "verification_commands", "rollback_plan"] },
  { key: "product", requirements: ["objective_scorecard", "journey_coverage", "self_explanation_proof", "decision_log"] },
  { key: "security", requirements: ["threat_model", "rls_negative_tests", "retention_controls", "external_link_review"] },
  { key: "support", requirements: ["diagnostic_runbook", "failure_categories", "customer_safe_copy", "escalation_paths"] },
  { key: "release", requirements: ["change_freeze", "evidence_promotion", "dry_run_criteria", "post_release_review"] },
] as const;

export type V10SupportAccessLevel = "user" | "support" | "admin" | "service_role" | "break_glass";

export type V10SupportAdminAccessRequest = {
  accessLevel: V10SupportAccessLevel;
  organizationId?: string | null;
  actorId?: string | null;
  reason?: string | null;
  auditEventId?: string | null;
  approvedBy?: string | null;
  expiresAt?: string | null;
  supportSafeOnly?: boolean;
};

export type V10DisasterRecoveryDrill = {
  scope: "read_model_rebuild" | "job_replay" | "evidence_restore" | "fixture_rebuild" | "degraded_mode";
  owner?: string | null;
  backupVerified?: boolean;
  restoreTested?: boolean;
  replaySafe?: boolean;
  privateDataLeakCheckPassed?: boolean;
  evidenceCapturedAt?: string | null;
};

export type V10CanaryControlDecision = {
  state: "disabled" | "internal_only" | "fixture_only" | "beta_canary" | "beta_broad" | "GA_candidate" | "GA" | "paused" | "rolled_back";
  organizationScope?: readonly string[];
  metricsFresh?: boolean;
  killSwitchReady?: boolean;
  rollbackReady?: boolean;
  unresolvedBlockers?: readonly string[];
  ownerSignoff?: string | null;
};

export type V10DataQualityRemediationInput = {
  gap: "missing_field" | "stale_owner" | "rejected_evidence" | "missing_dates" | "failed_extraction" | "duplicate_record";
  visibleWorkCreated?: boolean;
  remediationAction?: string | null;
  auditEventId?: string | null;
  telemetryOutcome?: string | null;
};

export type V10OperatorRunbook = {
  key: string;
  owner: "engineering" | "operations" | "support" | "security" | "release";
  trigger: string;
  diagnosticPrefix: string;
  recoveryDestination: string;
  customerSafeCopy: string;
  completionProof: "release_evidence_record" | "audit_event" | "verification_command";
};

export type V10OperationalRecoveryManifest = {
  runbook_key: string;
  owner: V10OperatorRunbook["owner"];
  diagnostic_id: string;
  recovery_destination: string;
  customer_safe_copy: string;
  completion_proof: V10OperatorRunbook["completionProof"];
  requires_kill_switch_review: boolean;
  requires_read_model_repair: boolean;
  requires_artifact_revocation: boolean;
};

export type V10DataDictionaryEntry = {
  source: string;
  owner: "engineering" | "product" | "operations" | "security" | "release";
  privacyClass: "client_safe" | "server_safe" | "audit_safe" | "telemetry_safe" | "export_safe" | "diagnostic_safe";
  retentionClass: "active_record" | "audit_retained" | "artifact_expiring" | "release_evidence" | "external_link_expiring";
  readModelTargets: readonly string[];
  fixtureTargets: readonly string[];
  redactionPolicy: "none" | "support_safe" | "export_selected_fields" | "token_hash_only" | "synthetic_only";
};

export type V10ProviderBoundaryContract = {
  provider: "supabase" | "resend" | "openai" | "stripe" | "vercel_cron" | "storage" | "malware_scan" | "signed_url" | "playwright";
  requiredServerEnv: readonly string[];
  publicEnvAllowed: readonly string[];
  outageState: string;
  privacyBoundary: "service_role_server_only" | "metadata_only" | "synthetic_credentials" | "short_lived_scope";
  releaseBlockerWhenMissing: boolean;
};

export type V10ProviderReadinessSnapshot = {
  provider: V10ProviderBoundaryContract["provider"];
  ready: boolean;
  missingEnv: readonly string[];
  outageState: string;
  releaseBlocker: boolean;
  recoveryDestination: string;
};

export type V10SupportDiagnosticView = {
  key: string;
  allowedAccessLevels: readonly V10SupportAccessLevel[];
  fields: readonly string[];
  prohibitedFields: readonly string[];
  impersonationAllowed: boolean;
  escalationOwner: "support" | "engineering" | "security" | "release";
  remediationCopy: string;
};

export type V10OperationalIncidentState = "none" | "open" | "investigating" | "mitigated" | "resolved";
export type V10EvidenceFreshnessState = "fresh" | "stale" | "missing" | "not_applicable";

export type V10OperationalAlert = {
  key: string;
  diagnosticId: string;
  severity: "info" | "warning" | "critical";
  audiences: readonly ("operator" | "support" | "admin")[];
  incidentState: V10OperationalIncidentState;
  evidenceFreshness: V10EvidenceFreshnessState;
  escalationOwner: "support" | "engineering" | "security" | "operations" | "release";
  recoveryDestination: string;
  customerSafeCopy: string;
};

export type V10AuditImmutabilityProbe = {
  table: "v10_audit_events" | "v10_release_evidence_records" | "v10_mutation_idempotency" | "v10_runtime_artifacts";
  operation: "append" | "update" | "delete";
  actorServerDerived: boolean;
  compensatingEventId: string | null;
  metadataSupportSafe: boolean;
  evidenceKey: string;
};

export type V10PostGaDriftControl = {
  key:
    | "post_ga_slo_7_day"
    | "post_ga_slo_30_day"
    | "read_model_drift"
    | "route_catalog_drift"
    | "telemetry_schema_drift"
    | "audit_vocabulary_drift"
    | "report_export_artifact_drift"
    | "provider_config_drift"
    | "fixture_staleness"
    | "release_evidence_expiry"
    | "incident_rollback_drill";
  owner: "engineering" | "operations" | "support" | "security" | "release";
  checkCommand: string;
  dashboardKey: string;
  evidenceFreshnessHours: number;
  recoveryDestination: string;
  rollbackCommand: string;
  supportSafeEscalation: string;
};

export type V10ApiEnvironmentIntegrationContract = {
  key:
    | "request_response_schema"
    | "cache_policy"
    | "environment_parity"
    | "entitlement_billing_sync"
    | "integration_boundary"
    | "pagination_filtering_sorting"
    | "version_compatibility"
    | "concurrency_time_bounds";
  owner: "engineering" | "operations" | "security" | "release";
  runtimeArtifact: string;
  negativeTestArtifact: string;
  cachePolicy: "private_no_store" | "static_safe";
  requiredEnvKeys: readonly string[];
  compatibilityBoundary: string;
  rateLimitPolicy: "standard_user" | "mutation" | "cron" | "external_link";
  releaseGate: string;
};

export type V10DataLifecycleComplianceContract = {
  operation:
    | "create"
    | "update"
    | "archive"
    | "delete"
    | "restore"
    | "retention_expiry"
    | "artifact_revocation"
    | "external_link_revocation"
    | "fixture_teardown"
    | "audit_retention"
    | "release_evidence_expiry"
    | "support_diagnostic_expiration"
    | "dsar_delete_request";
  retentionPolicy: string;
  privacyRedaction: "none" | "support_safe" | "export_selected_fields" | "token_hash_only" | "synthetic_only";
  auditAction: string;
  supportBoundary: string;
  customerSafeDiagnostic: string;
  cleanupCommand: string;
  complianceEvidenceKey: string;
};

export type V10LegacyBridgeDecommissionContract = {
  bridge: "v4_actions" | "v6_settings" | "v8_surface_guard" | "v9_telemetry" | "legacy_report_pack";
  owner: "engineering" | "operations" | "product" | "security";
  replacementArtifact: string;
  runtimeUsageCheck: string;
  removalGate: string;
  rollbackPlan: string;
  compatibilityBoundary: string;
};

export type V10SupportAdminVisibilityRow = {
  key: string;
  severity: V10OperationalAlert["severity"];
  incident_state: V10OperationalIncidentState;
  evidence_freshness: V10EvidenceFreshnessState;
  escalation_owner: V10OperationalAlert["escalationOwner"];
  recovery_destination: string;
  customer_safe_copy: string;
  diagnostic_id: string | null;
};

export type V10DestructiveOperationContract = {
  operation:
    | "archive_contract"
    | "delete_contract"
    | "restore_contract"
    | "revoke_export_artifact"
    | "revoke_evidence_link"
    | "cancel_job"
    | "retry_job"
    | "release_rollback"
    | "incident_kill_switch";
  requiresExpectedVersion: boolean;
  requiresAudit: boolean;
  requiresIdempotency: boolean;
  requiresReason: boolean;
  reversible: boolean;
  readModelRefreshRequired: boolean;
  customerSafeWarning: string;
};

export type V10ObservabilityPerformanceA11yContract = {
  surface: "home" | "work" | "contract_record" | "command_palette" | "reports_exports" | "settings_health";
  telemetrySignals: readonly string[];
  alertThresholds: readonly string[];
  performanceBudgets: readonly string[];
  accessibilityStates: readonly string[];
  scaleFixture: string;
  supportDiagnosticFields: readonly string[];
};

export type V10OperationalRunbookCoverage = {
  key:
    | "read_model_rebuild"
    | "idempotency_cleanup"
    | "runtime_artifact_cleanup"
    | "fixture_teardown"
    | "failed_report_recovery"
    | "failed_export_recovery"
    | "failed_import_recovery"
    | "evidence_escalation"
    | "notification_failure"
    | "audit_write_failure";
  owner: "engineering" | "operations" | "support" | "security" | "release";
  trigger: string;
  command: string;
  recoveryDestination: string;
  releaseEvidenceKey: `ops:${string}`;
  supportSafe: boolean;
  incidentReadinessCheck: string;
};

export type V10QualityMatrixRow = {
  surface:
    | "home"
    | "work"
    | "contracts"
    | "contract_detail"
    | "review"
    | "renewals"
    | "obligations"
    | "evidence"
    | "approvals"
    | "exceptions"
    | "reports"
    | "settings"
    | "command_palette"
    | "external_evidence_submission";
  accessibilityCoverage: readonly string[];
  keyboardCoverage: readonly string[];
  screenReaderCoverage: readonly string[];
  responsiveViewports: readonly string[];
  performanceBudget: string;
  browserCoverage: readonly ("chromium" | "webkit" | "firefox")[];
  visualRegressionSmoke: boolean;
  evidenceKey: `quality:${string}`;
};

export type V10FinalCutoverChecklistRow = {
  key:
    | "no_exclusions_matrix"
    | "fixture_manifest_freeze"
    | "beta_promotion"
    | "ga_promotion"
    | "complete_promotion"
    | "legacy_boundary_decisions"
    | "hidden_p1_p2_security"
    | "included_p2_runtime"
    | "unclassified_requirement_sweep"
    | "final_handoff";
  releaseState: "beta" | "GA" | "complete";
  owner: "engineering" | "product" | "operations" | "security" | "support" | "release";
  gateCommand: string;
  blocksPromotion: boolean;
  evidenceKey: `cutover:${string}`;
  residualRiskPolicy: "block" | "owner_signoff_required" | "monitor_post_ga";
};

export type V10OpsReleaseReadinessContract = {
  key:
    | "read_model_refresh"
    | "idempotency_cleanup"
    | "runtime_artifact_cleanup"
    | "provider_readiness"
    | "slo_canary"
    | "support_handoff"
    | "rollback_repair";
  owner: "engineering" | "operations" | "support" | "security" | "release";
  cronRoute: string | null;
  diagnosticPrefix: string;
  retentionDays: number;
  sloDashboardKey: string;
  rollbackCommand: string;
  recoveryDestination: string;
  providerBlockers: readonly V10ProviderBoundaryContract["provider"][];
  releaseEvidenceKey: string;
};

export const V10_SETTINGS_HEALTH_RECOVERY_ANCHORS = [
  "read-models",
  "jobs",
  "coverage-ledger",
  "runtime-artifacts",
  "exports",
  "v10-runtime",
  "mutations",
  "artifacts",
  "providers",
  "canary",
  "support",
  "rollback",
] as const;

export const V10_DESTRUCTIVE_OPERATION_CONTRACTS: readonly V10DestructiveOperationContract[] = [
  { operation: "archive_contract", requiresExpectedVersion: true, requiresAudit: true, requiresIdempotency: true, requiresReason: true, reversible: true, readModelRefreshRequired: true, customerSafeWarning: "Archived records leave active views but audit history remains available." },
  { operation: "delete_contract", requiresExpectedVersion: true, requiresAudit: true, requiresIdempotency: true, requiresReason: true, reversible: false, readModelRefreshRequired: true, customerSafeWarning: "Deleted records are removed from active workspace views." },
  { operation: "restore_contract", requiresExpectedVersion: true, requiresAudit: true, requiresIdempotency: true, requiresReason: true, reversible: true, readModelRefreshRequired: true, customerSafeWarning: "Restored records return to active workspace views after refresh." },
  { operation: "revoke_export_artifact", requiresExpectedVersion: true, requiresAudit: true, requiresIdempotency: true, requiresReason: true, reversible: false, readModelRefreshRequired: false, customerSafeWarning: "Revoked export links can no longer be downloaded." },
  { operation: "revoke_evidence_link", requiresExpectedVersion: true, requiresAudit: true, requiresIdempotency: true, requiresReason: true, reversible: false, readModelRefreshRequired: false, customerSafeWarning: "Revoked evidence links can no longer receive submissions." },
  { operation: "cancel_job", requiresExpectedVersion: true, requiresAudit: true, requiresIdempotency: true, requiresReason: false, reversible: false, readModelRefreshRequired: true, customerSafeWarning: "Canceled jobs stop processing and may need a fresh retry." },
  { operation: "retry_job", requiresExpectedVersion: true, requiresAudit: true, requiresIdempotency: true, requiresReason: false, reversible: true, readModelRefreshRequired: true, customerSafeWarning: "Retrying a job keeps prior diagnostics visible." },
  { operation: "release_rollback", requiresExpectedVersion: false, requiresAudit: true, requiresIdempotency: true, requiresReason: true, reversible: true, readModelRefreshRequired: true, customerSafeWarning: "Rollback returns the workspace to the previous release behavior." },
  { operation: "incident_kill_switch", requiresExpectedVersion: false, requiresAudit: true, requiresIdempotency: true, requiresReason: true, reversible: true, readModelRefreshRequired: false, customerSafeWarning: "A temporary safety control disabled the affected workflow." },
] as const;

export const V10_SUPPORT_DIAGNOSTIC_VIEWS: readonly V10SupportDiagnosticView[] = [
  {
    key: "job_failure",
    allowedAccessLevels: ["support", "admin", "service_role"],
    fields: ["diagnostic_id", "failure_category", "retry_eligibility", "job_class", "organization_id"],
    prohibitedFields: ["raw_contract_text", "provider_payload", "secret", "token"],
    impersonationAllowed: false,
    escalationOwner: "engineering",
    remediationCopy: "Retry the job or escalate with the diagnostic ID.",
  },
  {
    key: "external_link",
    allowedAccessLevels: ["support", "admin"],
    fields: ["diagnostic_id", "link_state", "expires_at", "revoked_at"],
    prohibitedFields: ["signed_link_token", "responder_email"],
    impersonationAllowed: false,
    escalationOwner: "security",
    remediationCopy: "Request a fresh scoped link from the workspace owner.",
  },
  {
    key: "release_blocker",
    allowedAccessLevels: ["admin", "service_role", "break_glass"],
    fields: ["metric_key", "blocker_id", "owner", "freshness_state"],
    prohibitedFields: ["customer_payload", "secret", "token"],
    impersonationAllowed: false,
    escalationOwner: "release",
    remediationCopy: "Promote fresh evidence or keep the release blocker active.",
  },
] as const;

export const V10_OPERATIONAL_ALERTS: readonly V10OperationalAlert[] = [
  {
    key: "read_model_refresh_failure",
    diagnosticId: "v10_read_model_refresh",
    severity: "critical",
    audiences: ["operator", "support", "admin"],
    incidentState: "open",
    evidenceFreshness: "stale",
    escalationOwner: "engineering",
    recoveryDestination: "/settings/health#read-models",
    customerSafeCopy: "Workspace views are refreshing more slowly than expected. Health includes the recovery path.",
  },
  {
    key: "release_evidence_stale",
    diagnosticId: "v10_release_evidence",
    severity: "warning",
    audiences: ["operator", "admin"],
    incidentState: "investigating",
    evidenceFreshness: "stale",
    escalationOwner: "release",
    recoveryDestination: "/settings/health#v10-runtime",
    customerSafeCopy: "Release evidence needs a fresh automated run before promotion can continue.",
  },
  {
    key: "external_link_failures",
    diagnosticId: "v10_external_link",
    severity: "warning",
    audiences: ["support", "admin"],
    incidentState: "mitigated",
    evidenceFreshness: "fresh",
    escalationOwner: "security",
    recoveryDestination: "/contracts/evidence-studio",
    customerSafeCopy: "Some evidence links need fresh scoped invitations from the workspace owner.",
  },
  {
    key: "idempotency_rpc_failures",
    diagnosticId: "v10_idempotency",
    severity: "critical",
    audiences: ["operator", "support", "admin"],
    incidentState: "investigating",
    evidenceFreshness: "stale",
    escalationOwner: "engineering",
    recoveryDestination: "/settings/health#v10-runtime",
    customerSafeCopy: "Retry protection is not recording changes reliably. Health includes the recovery path.",
  },
  {
    key: "audit_write_failures",
    diagnosticId: "v10_audit_write",
    severity: "critical",
    audiences: ["operator", "support", "admin"],
    incidentState: "open",
    evidenceFreshness: "stale",
    escalationOwner: "security",
    recoveryDestination: "/settings/health#support",
    customerSafeCopy: "Some changes are blocked because audit evidence could not be recorded safely.",
  },
  {
    key: "command_index_partial",
    diagnosticId: "v10_command_index_partial",
    severity: "warning",
    audiences: ["operator", "admin"],
    incidentState: "investigating",
    evidenceFreshness: "fresh",
    escalationOwner: "operations",
    recoveryDestination: "/settings/health#search",
    customerSafeCopy: "Command search is falling back to direct destinations while the index recovers.",
  },
] as const;

export const V10_AUDIT_IMMUTABILITY_PROBES: readonly V10AuditImmutabilityProbe[] = [
  { table: "v10_audit_events", operation: "append", actorServerDerived: true, compensatingEventId: null, metadataSupportSafe: true, evidenceKey: "audit:v10_audit_events:append_only" },
  { table: "v10_release_evidence_records", operation: "update", actorServerDerived: true, compensatingEventId: "release_evidence.superseded", metadataSupportSafe: true, evidenceKey: "audit:v10_release_evidence_records:supersession" },
  { table: "v10_mutation_idempotency", operation: "delete", actorServerDerived: true, compensatingEventId: "idempotency.retention_cleanup", metadataSupportSafe: true, evidenceKey: "audit:v10_mutation_idempotency:retention_cleanup" },
  { table: "v10_runtime_artifacts", operation: "update", actorServerDerived: true, compensatingEventId: "runtime_artifact.revoked", metadataSupportSafe: true, evidenceKey: "audit:v10_runtime_artifacts:revocation" },
] as const;

export const V10_POST_GA_DRIFT_CONTROLS: readonly V10PostGaDriftControl[] = [
  { key: "post_ga_slo_7_day", owner: "operations", checkCommand: "npm run check:v10-release-evidence -- --post-ga 7d", dashboardKey: "post_ga_operational_window", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#canary", rollbackCommand: "npm run report:canary-blast-radius", supportSafeEscalation: "Review 7-day SLO misses with diagnostic IDs only." },
  { key: "post_ga_slo_30_day", owner: "operations", checkCommand: "npm run check:v10-release-evidence -- --post-ga 30d", dashboardKey: "post_ga_operational_window", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#canary", rollbackCommand: "npm run report:canary-blast-radius", supportSafeEscalation: "Review 30-day SLO trend with release evidence links." },
  { key: "read_model_drift", owner: "engineering", checkCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run", dashboardKey: "work_reachability", evidenceFreshnessHours: 6, recoveryDestination: "/settings/health#read-models", rollbackCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run", supportSafeEscalation: "Escalate stale read-model diagnostics without source payloads." },
  { key: "route_catalog_drift", owner: "engineering", checkCommand: "npm run check:v10-suite", dashboardKey: "api_contracts", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#v10-runtime", rollbackCommand: "npm run check:v10-suite", supportSafeEscalation: "Compare route catalog failures with support-safe paths only." },
  { key: "telemetry_schema_drift", owner: "security", checkCommand: "npm run check:v10-release-evidence", dashboardKey: "telemetry_safe_metadata", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#v10-runtime", rollbackCommand: "npm run check:v10-release-evidence", supportSafeEscalation: "Block unsafe telemetry metadata before promotion." },
  { key: "audit_vocabulary_drift", owner: "security", checkCommand: "npm run check:v10-suite", dashboardKey: "audit_safe_metadata", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#support", rollbackCommand: "npm run check:v10-suite", supportSafeEscalation: "Keep audit action drift in security review." },
  { key: "report_export_artifact_drift", owner: "operations", checkCommand: "npm run check:v10-release-evidence", dashboardKey: "report_export_reliability", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#artifacts", rollbackCommand: "npm run check:v10-release-evidence", supportSafeEscalation: "Revoke stale artifacts and expose only artifact IDs." },
  { key: "provider_config_drift", owner: "operations", checkCommand: "npm run check:v10-release-evidence -- --external-blockers", dashboardKey: "provider_readiness", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#providers", rollbackCommand: "npm run check:v10-release-evidence", supportSafeEscalation: "Use provider outage state without private config values." },
  { key: "fixture_staleness", owner: "release", checkCommand: "npm run check:v10-suite -- --fixture all", dashboardKey: "fixture_freshness", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#coverage-ledger", rollbackCommand: "npm run check:v10-suite -- --cleanup-fixture all", supportSafeEscalation: "Refresh synthetic fixtures before metric capture." },
  { key: "release_evidence_expiry", owner: "release", checkCommand: "npm run check:v10-release-evidence", dashboardKey: "release_evidence_freshness", evidenceFreshnessHours: 24, recoveryDestination: "/settings/health#v10-runtime", rollbackCommand: "npm run check:v10-release-evidence", supportSafeEscalation: "Keep expired evidence blocked until refreshed." },
  { key: "incident_rollback_drill", owner: "support", checkCommand: "npm run check:v10-release-evidence -- --external-blockers", dashboardKey: "incident_response", evidenceFreshnessHours: 168, recoveryDestination: "/settings/health#rollback", rollbackCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run", supportSafeEscalation: "Run rollback drill with customer-safe incident copy." },
] as const;

export const V10_API_ENVIRONMENT_INTEGRATION_CONTRACTS: readonly V10ApiEnvironmentIntegrationContract[] = [
  { key: "request_response_schema", owner: "engineering", runtimeArtifact: "src/lib/v10-route-api-catalog.ts", negativeTestArtifact: "src/lib/v10-route-api-catalog.v10.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: ["SUPABASE_SERVICE_ROLE_KEY"], compatibilityBoundary: "v10_api_response_schemas", rateLimitPolicy: "standard_user", releaseGate: "npm run check:v10-suite" },
  { key: "cache_policy", owner: "security", runtimeArtifact: "src/lib/v10-route-api-catalog.ts", negativeTestArtifact: "src/lib/v10-route-api-catalog.v10.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: [], compatibilityBoundary: "v10_cache_policy", rateLimitPolicy: "standard_user", releaseGate: "npm run check:v10-suite" },
  { key: "environment_parity", owner: "operations", runtimeArtifact: "src/lib/v10-operational-contracts.ts", negativeTestArtifact: "src/lib/v10-operational-contracts.v10.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: ["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "RESEND_API_KEY"], compatibilityBoundary: "v10_provider_configuration", rateLimitPolicy: "cron", releaseGate: "npm run check:v10-release-evidence" },
  { key: "entitlement_billing_sync", owner: "operations", runtimeArtifact: "src/actions/product-surface-settings.ts", negativeTestArtifact: "src/actions/product-surface-settings.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: ["STRIPE_SECRET_KEY"], compatibilityBoundary: "v10_entitlement_state", rateLimitPolicy: "mutation", releaseGate: "npm run check:v10-suite" },
  { key: "integration_boundary", owner: "security", runtimeArtifact: "src/lib/v10-operational-contracts.ts", negativeTestArtifact: "src/lib/v10-operational-contracts.v10.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: ["OPENAI_API_KEY", "RESEND_API_KEY"], compatibilityBoundary: "v10_provider_configuration", rateLimitPolicy: "external_link", releaseGate: "npm run check:v10-release-evidence" },
  { key: "pagination_filtering_sorting", owner: "engineering", runtimeArtifact: "src/lib/v10-route-api-catalog.ts", negativeTestArtifact: "src/app/api/command-palette/contracts/route.v10.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: [], compatibilityBoundary: "v10_api_response_schemas", rateLimitPolicy: "standard_user", releaseGate: "npm run check:v10-suite" },
  { key: "version_compatibility", owner: "engineering", runtimeArtifact: "src/lib/v10-mutation-envelope.ts", negativeTestArtifact: "src/lib/v10-server-contracts.v10.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: [], compatibilityBoundary: "v10_api_response_schemas", rateLimitPolicy: "mutation", releaseGate: "npm run check:v10-suite" },
  { key: "concurrency_time_bounds", owner: "engineering", runtimeArtifact: "src/lib/v10-server-contracts.ts", negativeTestArtifact: "src/lib/v10-server-contracts.v10.test.ts", cachePolicy: "private_no_store", requiredEnvKeys: [], compatibilityBoundary: "v10_idempotency_replay", rateLimitPolicy: "mutation", releaseGate: "npm run check:v10-suite" },
] as const;

export const V10_DATA_LIFECYCLE_COMPLIANCE_CONTRACTS: readonly V10DataLifecycleComplianceContract[] = [
  { operation: "create", retentionPolicy: "active_record", privacyRedaction: "none", auditAction: "record.created", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Created records are visible after refresh.", cleanupCommand: "npm run check:v10-suite", complianceEvidenceKey: "compliance:create" },
  { operation: "update", retentionPolicy: "active_record", privacyRedaction: "support_safe", auditAction: "record.updated", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Updated records retain audit history.", cleanupCommand: "npm run check:v10-suite", complianceEvidenceKey: "compliance:update" },
  { operation: "archive", retentionPolicy: "audit_retained", privacyRedaction: "support_safe", auditAction: "record.archived", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Archived records leave active views while audit remains.", cleanupCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run", complianceEvidenceKey: "compliance:archive" },
  { operation: "delete", retentionPolicy: "audit_retained", privacyRedaction: "support_safe", auditAction: "record.deleted", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Deleted records are removed from active views.", cleanupCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run", complianceEvidenceKey: "compliance:delete" },
  { operation: "restore", retentionPolicy: "active_record", privacyRedaction: "support_safe", auditAction: "record.restored", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Restored records return after refresh.", cleanupCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run", complianceEvidenceKey: "compliance:restore" },
  { operation: "retention_expiry", retentionPolicy: "artifact_expiring", privacyRedaction: "support_safe", auditAction: "retention.expired", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Expired artifacts are no longer downloadable.", cleanupCommand: "npm run check:v10-release-evidence", complianceEvidenceKey: "compliance:retention_expiry" },
  { operation: "artifact_revocation", retentionPolicy: "artifact_expiring", privacyRedaction: "export_selected_fields", auditAction: "artifact.revoked", supportBoundary: "artifact_id_only", customerSafeDiagnostic: "Revoked artifacts require regeneration.", cleanupCommand: "npm run check:v10-release-evidence", complianceEvidenceKey: "compliance:artifact_revocation" },
  { operation: "external_link_revocation", retentionPolicy: "external_link_expiring", privacyRedaction: "token_hash_only", auditAction: "external_link.revoked", supportBoundary: "token_hash_only", customerSafeDiagnostic: "Revoked evidence links need a fresh invitation.", cleanupCommand: "npm run check:v10-suite", complianceEvidenceKey: "compliance:external_link_revocation" },
  { operation: "fixture_teardown", retentionPolicy: "release_evidence", privacyRedaction: "synthetic_only", auditAction: "fixture.teardown", supportBoundary: "synthetic_only", customerSafeDiagnostic: "Synthetic fixtures can be rebuilt from the manifest.", cleanupCommand: "npm run check:v10-suite -- --cleanup-fixture all", complianceEvidenceKey: "compliance:fixture_teardown" },
  { operation: "audit_retention", retentionPolicy: "audit_retained", privacyRedaction: "support_safe", auditAction: "audit.retained", supportBoundary: "audit_safe_metadata", customerSafeDiagnostic: "Audit history is retained without private payloads.", cleanupCommand: "npm run check:v10-release-evidence", complianceEvidenceKey: "compliance:audit_retention" },
  { operation: "release_evidence_expiry", retentionPolicy: "release_evidence", privacyRedaction: "synthetic_only", auditAction: "release_evidence.expired", supportBoundary: "synthetic_only", customerSafeDiagnostic: "Expired release evidence blocks promotion until refreshed.", cleanupCommand: "npm run check:v10-release-evidence", complianceEvidenceKey: "compliance:release_evidence_expiry" },
  { operation: "support_diagnostic_expiration", retentionPolicy: "audit_retained", privacyRedaction: "support_safe", auditAction: "support_diagnostic.expired", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Expired diagnostics require fresh reproduction.", cleanupCommand: "npm run check:v10-release-evidence", complianceEvidenceKey: "compliance:support_diagnostic_expiration" },
  { operation: "dsar_delete_request", retentionPolicy: "audit_retained", privacyRedaction: "support_safe", auditAction: "privacy_request.completed", supportBoundary: "support_safe_metadata", customerSafeDiagnostic: "Privacy requests redact eligible responder data while preserving required audit.", cleanupCommand: "npm run check:v10-release-evidence", complianceEvidenceKey: "compliance:dsar_delete_request" },
] as const;

export const V10_LEGACY_BRIDGE_DECOMMISSION_CONTRACTS: readonly V10LegacyBridgeDecommissionContract[] = [
  { bridge: "v4_actions", owner: "engineering", replacementArtifact: "src/lib/v10-server-contracts.ts", runtimeUsageCheck: "npm run check:v10-suite", removalGate: "all catalog mutations use v10 envelopes", rollbackPlan: "restore v4 action bridge behind compatibility boundary", compatibilityBoundary: "legacy_server_actions" },
  { bridge: "v6_settings", owner: "operations", replacementArtifact: "src/actions/product-surface-settings.ts", runtimeUsageCheck: "npm run check:v10-suite", removalGate: "settings health reports v10 mode/module state", rollbackPlan: "preserve v6 org settings reader until migration evidence is promoted", compatibilityBoundary: "workspace_settings" },
  { bridge: "v8_surface_guard", owner: "security", replacementArtifact: "src/lib/product-surface/api-workspace-guard.ts", runtimeUsageCheck: "npm run check:v10-privacy-scan", removalGate: "v10 workspace denials are envelope-backed", rollbackPlan: "fall back to v8 guard with v10 response wrapper", compatibilityBoundary: "surface_eligibility" },
  { bridge: "v9_telemetry", owner: "product", replacementArtifact: "src/lib/product-telemetry.ts", runtimeUsageCheck: "npm run check:v10-release-evidence", removalGate: "v10 objective telemetry has promoted runtime evidence", rollbackPlan: "keep compatibility bridge until post-GA evidence passes", compatibilityBoundary: "objective_telemetry" },
  { bridge: "legacy_report_pack", owner: "engineering", replacementArtifact: "src/app/api/report-packs/route.ts", runtimeUsageCheck: "npm run check:v10-suite", removalGate: "report_run audit/read-model naming is canonical", rollbackPlan: "map legacy report_pack callers through mutation alias", compatibilityBoundary: "report_run_alias" },
] as const;

export const V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS: readonly V10ObservabilityPerformanceA11yContract[] = [
  {
    surface: "home",
    telemetrySignals: ["product.v10.activation_completed", "product.v10.first_work_item_generated"],
    alertThresholds: ["read_model_stale_minutes", "dashboard_query_error_rate"],
    performanceBudgets: ["first_fold_under_1200ms", "summary_counts_under_400ms"],
    accessibilityStates: ["empty_state_focus", "retry_banner_announced"],
    scaleFixture: "large_workspace_dashboard",
    supportDiagnosticFields: ["diagnostic_id", "refresh_scope", "lineage_status"],
  },
  {
    surface: "work",
    telemetrySignals: ["product.v10.work_item_completed", "product.v10.review_queue_cleared"],
    alertThresholds: ["work_queue_stale_minutes", "mutation_conflict_rate"],
    performanceBudgets: ["one_thousand_rows_paginated", "bulk_action_feedback_under_800ms"],
    accessibilityStates: ["focus_returns_to_completed_row", "bulk_action_status_announced"],
    scaleFixture: "large_work_queue",
    supportDiagnosticFields: ["diagnostic_id", "lens", "source_object_type"],
  },
  {
    surface: "contract_record",
    telemetrySignals: ["product.v10.contract_record_trust_viewed", "product.v10.review_queue_cleared"],
    alertThresholds: ["field_provenance_missing_rate", "contract_activity_stale_minutes"],
    performanceBudgets: ["activity_timeline_paginated", "field_review_save_under_700ms"],
    accessibilityStates: ["section_disclosure_preserved", "drawer_focus_trap"],
    scaleFixture: "large_contract_record",
    supportDiagnosticFields: ["diagnostic_id", "contract_health_state", "provenance_state"],
  },
  {
    surface: "command_palette",
    telemetrySignals: ["product.v10.command_palette_result_selected", "product.v10.command_palette_zero_result"],
    alertThresholds: ["search_error_rate", "hidden_result_probe_rate"],
    performanceBudgets: ["debounced_search_under_250ms", "result_limit_enforced"],
    accessibilityStates: ["active_descendant_announced", "zero_result_recovery_focus"],
    scaleFixture: "large_search_index",
    supportDiagnosticFields: ["diagnostic_id", "query_class", "visibility_filter"],
  },
  {
    surface: "reports_exports",
    telemetrySignals: ["product.v10.report_run_completed", "product.v10.export_job_completed"],
    alertThresholds: ["failed_export_rate", "artifact_expiry_backlog"],
    performanceBudgets: ["async_handoff_over_threshold", "fifty_thousand_row_export_queued"],
    accessibilityStates: ["job_status_announced", "download_retry_focus"],
    scaleFixture: "large_report_export",
    supportDiagnosticFields: ["diagnostic_id", "job_class", "retry_action"],
  },
  {
    surface: "settings_health",
    telemetrySignals: ["product.v10.failed_job_retry_succeeded", "product.v10.release_check_recorded"],
    alertThresholds: ["provider_outage_count", "release_evidence_stale_minutes"],
    performanceBudgets: ["health_panel_under_800ms", "provider_matrix_paginated"],
    accessibilityStates: ["repair_result_announced", "tab_focus_preserved"],
    scaleFixture: "provider_outage_fixture",
    supportDiagnosticFields: ["diagnostic_id", "provider", "recovery_destination"],
  },
] as const;

export const V10_PROVIDER_BOUNDARIES: readonly V10ProviderBoundaryContract[] = [
  { provider: "supabase", requiredServerEnv: ["SUPABASE_SERVICE_ROLE_KEY"], publicEnvAllowed: ["NEXT_PUBLIC_SUPABASE_URL"], outageState: "database_unavailable", privacyBoundary: "service_role_server_only", releaseBlockerWhenMissing: true },
  { provider: "resend", requiredServerEnv: ["RESEND_API_KEY"], publicEnvAllowed: [], outageState: "email_provider_unavailable", privacyBoundary: "metadata_only", releaseBlockerWhenMissing: true },
  { provider: "openai", requiredServerEnv: ["OPENAI_API_KEY"], publicEnvAllowed: [], outageState: "ai_provider_unavailable", privacyBoundary: "metadata_only", releaseBlockerWhenMissing: true },
  { provider: "stripe", requiredServerEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], publicEnvAllowed: [], outageState: "billing_provider_unavailable", privacyBoundary: "metadata_only", releaseBlockerWhenMissing: false },
  { provider: "vercel_cron", requiredServerEnv: ["CRON_SECRET"], publicEnvAllowed: [], outageState: "cron_auth_unavailable", privacyBoundary: "service_role_server_only", releaseBlockerWhenMissing: true },
  { provider: "storage", requiredServerEnv: ["SUPABASE_SERVICE_ROLE_KEY"], publicEnvAllowed: [], outageState: "storage_unavailable", privacyBoundary: "service_role_server_only", releaseBlockerWhenMissing: true },
  { provider: "malware_scan", requiredServerEnv: ["MALWARE_SCAN_ENABLED"], publicEnvAllowed: [], outageState: "malware_scan_unavailable", privacyBoundary: "metadata_only", releaseBlockerWhenMissing: true },
  { provider: "signed_url", requiredServerEnv: ["SIGNED_URL_TTL_SECONDS"], publicEnvAllowed: [], outageState: "signed_url_unavailable", privacyBoundary: "short_lived_scope", releaseBlockerWhenMissing: true },
  { provider: "playwright", requiredServerEnv: ["E2E_BASE_URL", "E2E_EMAIL", "E2E_PASSWORD"], publicEnvAllowed: [], outageState: "e2e_credentials_unconfigured", privacyBoundary: "synthetic_credentials", releaseBlockerWhenMissing: false },
] as const;

export const V10_OPERATIONAL_RUNBOOK_COVERAGE: readonly V10OperationalRunbookCoverage[] = [
  { key: "read_model_rebuild", owner: "engineering", trigger: "stale_or_partial_v10_read_model", command: "node scripts/rebuild-v10-read-models.mjs --dry-run", recoveryDestination: "/settings/health#read-models", releaseEvidenceKey: "ops:read_model_rebuild", supportSafe: true, incidentReadinessCheck: "read_model_staleness_alert_has_owner" },
  { key: "idempotency_cleanup", owner: "engineering", trigger: "expired_or_stuck_idempotency_claims", command: "npm run check:v10-suite", recoveryDestination: "/settings/health#mutations", releaseEvidenceKey: "ops:idempotency_cleanup", supportSafe: true, incidentReadinessCheck: "claim_backlog_alert_has_owner" },
  { key: "runtime_artifact_cleanup", owner: "operations", trigger: "expired_runtime_artifact_backlog", command: "npm run check:v10-release-evidence", recoveryDestination: "/settings/health#artifacts", releaseEvidenceKey: "ops:runtime_artifact_cleanup", supportSafe: true, incidentReadinessCheck: "artifact_expiry_alert_has_owner" },
  { key: "fixture_teardown", owner: "release", trigger: "release_candidate_fixture_teardown", command: "npm run check:v10-suite -- --cleanup-fixture all", recoveryDestination: "/settings/health#coverage-ledger", releaseEvidenceKey: "ops:fixture_teardown", supportSafe: true, incidentReadinessCheck: "fixture_scope_is_generated_data_only" },
  { key: "failed_report_recovery", owner: "support", trigger: "failed_or_partial_report_run", command: "npm run check:v10-release-evidence", recoveryDestination: "/settings/health#artifacts", releaseEvidenceKey: "ops:failed_report_recovery", supportSafe: true, incidentReadinessCheck: "report_retry_diagnostic_visible" },
  { key: "failed_export_recovery", owner: "support", trigger: "failed_or_truncated_export_job", command: "npm run check:v10-release-evidence", recoveryDestination: "/settings/health#exports", releaseEvidenceKey: "ops:failed_export_recovery", supportSafe: true, incidentReadinessCheck: "export_redaction_and_retry_visible" },
  { key: "failed_import_recovery", owner: "support", trigger: "failed_import_or_extraction_job", command: "node scripts/rebuild-v10-read-models.mjs --dry-run", recoveryDestination: "/work?lens=failed_jobs", releaseEvidenceKey: "ops:failed_import_recovery", supportSafe: true, incidentReadinessCheck: "failed_job_lens_contains_retry_path" },
  { key: "evidence_escalation", owner: "operations", trigger: "overdue_evidence_request", command: "npm run check:v10-release-evidence -- --metric evidence_follow_up --lock v10-rc:evidence_follow_up:100", recoveryDestination: "/contracts/evidence-studio", releaseEvidenceKey: "ops:evidence_escalation", supportSafe: true, incidentReadinessCheck: "evidence_owner_notification_escalates" },
  { key: "notification_failure", owner: "operations", trigger: "notification_delivery_failure", command: "npm run check:v10-release-evidence", recoveryDestination: "/settings/health#providers", releaseEvidenceKey: "ops:notification_failure", supportSafe: true, incidentReadinessCheck: "provider_outage_state_is_support_safe" },
  { key: "audit_write_failure", owner: "security", trigger: "audit_write_failed_mutation_envelope", command: "npm run check:v10-suite", recoveryDestination: "/settings/health#support", releaseEvidenceKey: "ops:audit_write_failure", supportSafe: true, incidentReadinessCheck: "mutation_blocks_until_audit_safe" },
] as const;

export const V10_QUALITY_MATRIX: readonly V10QualityMatrixRow[] = [
  { surface: "home", accessibilityCoverage: ["landmarks", "recoverable_states"], keyboardCoverage: ["cta_focus"], screenReaderCoverage: ["status_announced"], responsiveViewports: ["320", "768", "1440x900"], performanceBudget: "first_fold_under_1200ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:home" },
  { surface: "work", accessibilityCoverage: ["table_headings", "bulk_status"], keyboardCoverage: ["bulk_actions", "row_actions"], screenReaderCoverage: ["lens_count_announced"], responsiveViewports: ["320", "375", "768", "1024"], performanceBudget: "one_thousand_rows_paginated", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:work" },
  { surface: "contracts", accessibilityCoverage: ["filter_labels", "empty_state"], keyboardCoverage: ["filter_tabs", "table_rows"], screenReaderCoverage: ["result_count_announced"], responsiveViewports: ["320", "768", "1440x900"], performanceBudget: "contract_filters_under_800ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:contracts" },
  { surface: "contract_detail", accessibilityCoverage: ["trust_header", "provenance_disclosure"], keyboardCoverage: ["field_review_save_next"], screenReaderCoverage: ["health_band_announced"], responsiveViewports: ["375", "768", "1440x900"], performanceBudget: "trust_header_under_900ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:contract_detail" },
  { surface: "review", accessibilityCoverage: ["queue_heading", "decision_feedback"], keyboardCoverage: ["approve_reject"], screenReaderCoverage: ["decision_status_announced"], responsiveViewports: ["320", "768", "1024"], performanceBudget: "save_and_next_under_700ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:review" },
  { surface: "renewals", accessibilityCoverage: ["posture_badges"], keyboardCoverage: ["checkpoint_actions"], screenReaderCoverage: ["due_state_announced"], responsiveViewports: ["320", "768", "1024"], performanceBudget: "renewal_query_under_800ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:renewals" },
  { surface: "obligations", accessibilityCoverage: ["owner_due_state"], keyboardCoverage: ["row_action"], screenReaderCoverage: ["evidence_link_state"], responsiveViewports: ["320", "768", "1024"], performanceBudget: "obligation_list_under_800ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:obligations" },
  { surface: "evidence", accessibilityCoverage: ["external_submission_status"], keyboardCoverage: ["upload_review_actions"], screenReaderCoverage: ["link_state_announced"], responsiveViewports: ["320", "375", "768"], performanceBudget: "evidence_review_under_900ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:evidence" },
  { surface: "approvals", accessibilityCoverage: ["sla_state"], keyboardCoverage: ["approve_reject_delegate"], screenReaderCoverage: ["decision_note_state"], responsiveViewports: ["320", "768", "1024"], performanceBudget: "approval_action_under_800ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:approvals" },
  { surface: "exceptions", accessibilityCoverage: ["severity_state"], keyboardCoverage: ["assign_resolve_reopen"], screenReaderCoverage: ["resolution_status_announced"], responsiveViewports: ["320", "768", "1024"], performanceBudget: "exception_action_under_800ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:exceptions" },
  { surface: "reports", accessibilityCoverage: ["job_status"], keyboardCoverage: ["generate_retry_download"], screenReaderCoverage: ["async_status_announced"], responsiveViewports: ["320", "768", "1024"], performanceBudget: "report_handoff_under_1000ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:reports" },
  { surface: "settings", accessibilityCoverage: ["health_tabs", "provider_matrix"], keyboardCoverage: ["module_toggle", "repair_action"], screenReaderCoverage: ["diagnostic_status_announced"], responsiveViewports: ["320", "768", "1024"], performanceBudget: "health_panel_under_800ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:settings" },
  { surface: "command_palette", accessibilityCoverage: ["combobox_active_descendant"], keyboardCoverage: ["open_search_select"], screenReaderCoverage: ["zero_result_announced"], responsiveViewports: ["320", "375", "768"], performanceBudget: "debounced_search_under_250ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:command_palette" },
  { surface: "external_evidence_submission", accessibilityCoverage: ["form_labels", "expired_state"], keyboardCoverage: ["upload_submit"], screenReaderCoverage: ["submission_status_announced"], responsiveViewports: ["320", "375", "768"], performanceBudget: "external_submit_under_1000ms", browserCoverage: ["chromium", "webkit", "firefox"], visualRegressionSmoke: true, evidenceKey: "quality:external_evidence_submission" },
] as const;

export const V10_FINAL_CUTOVER_CHECKLIST: readonly V10FinalCutoverChecklistRow[] = [
  { key: "no_exclusions_matrix", releaseState: "beta", owner: "release", gateCommand: "npm run check:v10-suite", blocksPromotion: true, evidenceKey: "cutover:no_exclusions_matrix", residualRiskPolicy: "block" },
  { key: "fixture_manifest_freeze", releaseState: "beta", owner: "release", gateCommand: "npm run check:v10-suite -- --fixture all", blocksPromotion: true, evidenceKey: "cutover:fixture_manifest_freeze", residualRiskPolicy: "block" },
  { key: "beta_promotion", releaseState: "beta", owner: "product", gateCommand: "npm run check:v10-release-evidence -- --metric all --lock all", blocksPromotion: true, evidenceKey: "cutover:beta_promotion", residualRiskPolicy: "owner_signoff_required" },
  { key: "ga_promotion", releaseState: "GA", owner: "release", gateCommand: "npm run check:v10-release-evidence -- --external-blockers none", blocksPromotion: true, evidenceKey: "cutover:ga_promotion", residualRiskPolicy: "owner_signoff_required" },
  { key: "complete_promotion", releaseState: "complete", owner: "operations", gateCommand: "npm run check:v10-release-evidence -- --post-ga 30d", blocksPromotion: true, evidenceKey: "cutover:complete_promotion", residualRiskPolicy: "block" },
  { key: "legacy_boundary_decisions", releaseState: "GA", owner: "engineering", gateCommand: "npm run check:v10-suite", blocksPromotion: true, evidenceKey: "cutover:legacy_boundary_decisions", residualRiskPolicy: "owner_signoff_required" },
  { key: "hidden_p1_p2_security", releaseState: "GA", owner: "security", gateCommand: "npm run check:v10-privacy-scan", blocksPromotion: true, evidenceKey: "cutover:hidden_p1_p2_security", residualRiskPolicy: "block" },
  { key: "included_p2_runtime", releaseState: "complete", owner: "product", gateCommand: "npm run check:v10-suite", blocksPromotion: true, evidenceKey: "cutover:included_p2_runtime", residualRiskPolicy: "owner_signoff_required" },
  { key: "unclassified_requirement_sweep", releaseState: "complete", owner: "release", gateCommand: "npm run check:v10-release-evidence", blocksPromotion: true, evidenceKey: "cutover:unclassified_requirement_sweep", residualRiskPolicy: "block" },
  { key: "final_handoff", releaseState: "complete", owner: "support", gateCommand: "npm run check:v10-release-evidence -- --external-blockers none", blocksPromotion: true, evidenceKey: "cutover:final_handoff", residualRiskPolicy: "monitor_post_ga" },
] as const;

export const V10_OPS_RELEASE_READINESS_CONTRACTS: readonly V10OpsReleaseReadinessContract[] = [
  {
    key: "read_model_refresh",
    owner: "engineering",
    cronRoute: "src/app/api/cron/v10/read-model-refresh/route.ts",
    diagnosticPrefix: "v10_read_model_refresh",
    retentionDays: 90,
    sloDashboardKey: "work_reachability",
    rollbackCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run",
    recoveryDestination: "/settings/health#read-models",
    providerBlockers: ["supabase", "vercel_cron"],
    releaseEvidenceKey: "ops:read_model_refresh",
  },
  {
    key: "idempotency_cleanup",
    owner: "engineering",
    cronRoute: "src/app/api/cron/v10/idempotency-cleanup/route.ts",
    diagnosticPrefix: "v10_idempotency_cleanup",
    retentionDays: 14,
    sloDashboardKey: "work_reachability",
    rollbackCommand: "npm run check:v10-suite",
    recoveryDestination: "/settings/health#mutations",
    providerBlockers: ["supabase", "vercel_cron"],
    releaseEvidenceKey: "ops:idempotency_cleanup",
  },
  {
    key: "runtime_artifact_cleanup",
    owner: "operations",
    cronRoute: "src/app/api/cron/v10/runtime-artifact-cleanup/route.ts",
    diagnosticPrefix: "v10_runtime_artifact_cleanup",
    retentionDays: 30,
    sloDashboardKey: "report_export_reliability",
    rollbackCommand: "npm run check:v10-release-evidence",
    recoveryDestination: "/settings/health#artifacts",
    providerBlockers: ["supabase", "storage", "signed_url"],
    releaseEvidenceKey: "ops:runtime_artifact_cleanup",
  },
  {
    key: "provider_readiness",
    owner: "operations",
    cronRoute: null,
    diagnosticPrefix: "v10_provider_readiness",
    retentionDays: 30,
    sloDashboardKey: "post_ga_operational_window",
    rollbackCommand: "npm run check:v10-release-evidence",
    recoveryDestination: "/settings/health#providers",
    providerBlockers: ["supabase", "resend", "openai", "storage", "malware_scan", "signed_url"],
    releaseEvidenceKey: "ops:provider_readiness",
  },
  {
    key: "slo_canary",
    owner: "release",
    cronRoute: null,
    diagnosticPrefix: "v10_canary",
    retentionDays: 30,
    sloDashboardKey: "post_ga_operational_window",
    rollbackCommand: "npm run report:canary-blast-radius",
    recoveryDestination: "/settings/health#canary",
    providerBlockers: ["playwright"],
    releaseEvidenceKey: "ops:slo_canary",
  },
  {
    key: "support_handoff",
    owner: "support",
    cronRoute: null,
    diagnosticPrefix: "v10_support",
    retentionDays: 730,
    sloDashboardKey: "post_ga_operational_window",
    rollbackCommand: "npm run check:v10-release-evidence",
    recoveryDestination: "/settings/health#support",
    providerBlockers: [],
    releaseEvidenceKey: "ops:support_handoff",
  },
  {
    key: "rollback_repair",
    owner: "release",
    cronRoute: null,
    diagnosticPrefix: "v10_rollback",
    retentionDays: 730,
    sloDashboardKey: "post_ga_operational_window",
    rollbackCommand: "node scripts/rebuild-v10-read-models.mjs --dry-run",
    recoveryDestination: "/settings/health#rollback",
    providerBlockers: ["supabase"],
    releaseEvidenceKey: "ops:rollback_repair",
  },
] as const;

export const V10_DATA_DICTIONARY: readonly V10DataDictionaryEntry[] = [
  {
    source: "contracts",
    owner: "product",
    privacyClass: "export_safe",
    retentionClass: "active_record",
    readModelTargets: ["v10_read_model_rows", "v10_work_items", "v10_contract_health_snapshots"],
    fixtureTargets: ["activation", "contract_record_trust", "work_reachability"],
    redactionPolicy: "export_selected_fields",
  },
  {
    source: "contract_import_jobs",
    owner: "engineering",
    privacyClass: "diagnostic_safe",
    retentionClass: "artifact_expiring",
    readModelTargets: ["v10_job_run_visibility", "v10_activation_state"],
    fixtureTargets: ["activation", "scripted_first_time_activation_sessions"],
    redactionPolicy: "support_safe",
  },
  {
    source: "evidence_requirements",
    owner: "product",
    privacyClass: "server_safe",
    retentionClass: "external_link_expiring",
    readModelTargets: ["v10_work_items", "v10_notification_deliveries"],
    fixtureTargets: ["evidence_follow_up", "recoverability"],
    redactionPolicy: "token_hash_only",
  },
  {
    source: "report_runs",
    owner: "operations",
    privacyClass: "diagnostic_safe",
    retentionClass: "artifact_expiring",
    readModelTargets: ["v10_report_run_visibility", "v10_work_items"],
    fixtureTargets: ["report_reliability", "export_reliability"],
    redactionPolicy: "support_safe",
  },
  {
    source: "v10_runtime_artifacts",
    owner: "operations",
    privacyClass: "diagnostic_safe",
    retentionClass: "artifact_expiring",
    readModelTargets: ["v10_report_run_visibility", "v10_job_run_visibility"],
    fixtureTargets: ["report_reliability", "export_reliability", "recoverability"],
    redactionPolicy: "support_safe",
  },
  {
    source: "v10_mutation_idempotency",
    owner: "engineering",
    privacyClass: "audit_safe",
    retentionClass: "audit_retained",
    readModelTargets: ["v10_audit_events"],
    fixtureTargets: ["work_reachability", "recoverability"],
    redactionPolicy: "support_safe",
  },
  {
    source: "v10_audit_events",
    owner: "security",
    privacyClass: "audit_safe",
    retentionClass: "audit_retained",
    readModelTargets: ["v10_audit_events", "v10_contract_activity_events"],
    fixtureTargets: ["work_reachability", "contract_record_trust", "recoverability"],
    redactionPolicy: "support_safe",
  },
  {
    source: "v10_release_evidence_records",
    owner: "release",
    privacyClass: "telemetry_safe",
    retentionClass: "release_evidence",
    readModelTargets: [],
    fixtureTargets: ["activation", "recoverability", "usability_participants"],
    redactionPolicy: "synthetic_only",
  },
] as const;

export const V10_OPERATOR_RUNBOOKS: readonly V10OperatorRunbook[] = [
  {
    key: "read_model_repair",
    owner: "operations",
    trigger: "stale_read_model_or_count_reconciliation_delta",
    diagnosticPrefix: "v10_read_model",
    recoveryDestination: "/settings/health#read-models",
    customerSafeCopy: "Workspace data is refreshing. Review health for recovery progress.",
    completionProof: "audit_event",
  },
  {
    key: "failed_job_retry",
    owner: "support",
    trigger: "failed_retryable_job_visibility_row",
    diagnosticPrefix: "v10_job",
    recoveryDestination: "/work?lens=failed_jobs",
    customerSafeCopy: "A retryable job needs attention. Retry from the failed-job lens.",
    completionProof: "audit_event",
  },
  {
    key: "provider_outage",
    owner: "operations",
    trigger: "provider_outage_with_retryable_diagnostics",
    diagnosticPrefix: "v10_provider",
    recoveryDestination: "/settings/health",
    customerSafeCopy: "A provider dependency is unavailable. Retry when service health recovers.",
    completionProof: "release_evidence_record",
  },
  {
    key: "canary_hold",
    owner: "release",
    trigger: "canary_metric_or_dashboard_freshness_failure",
    diagnosticPrefix: "v10_canary",
    recoveryDestination: "/settings/health",
    customerSafeCopy: "Release checks are on hold until operational evidence is refreshed.",
    completionProof: "release_evidence_record",
  },
  {
    key: "release_rollback",
    owner: "release",
    trigger: "rollback_threshold_or_owner_decision",
    diagnosticPrefix: "v10_rollback",
    recoveryDestination: "/settings/health",
    customerSafeCopy: "A release rollback is in progress. Current workspace actions remain visible.",
    completionProof: "verification_command",
  },
] as const;

export function getV10FailureRecoveryContract(domain: V10OperationalDomain, failureState: string): V10FailureRecoveryContract | null {
  return V10_FAILURE_RECOVERY_MATRIX.find((contract) => contract.domain === domain && contract.failureState === failureState) ?? null;
}

export function v10StaticContractHasRequirement(contracts: readonly V10StaticContract[], key: string, requirement: string): boolean {
  return contracts.some((contract) => contract.key === key && contract.requirements.includes(requirement));
}

export function validateV10StaticContractCoverage(contracts: readonly V10StaticContract[]): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.key)) failures.push(`duplicate_key:${contract.key}`);
    seen.add(contract.key);
    if (contract.requirements.length === 0) failures.push(`missing_requirements:${contract.key}`);
    for (const requirement of contract.requirements) {
      if (!/^[a-z0-9_]+$/.test(requirement)) failures.push(`invalid_requirement:${contract.key}:${requirement}`);
    }
  }
  return failures;
}

export function validateV10EdgeCaseMatrix(matrix: readonly V10StaticContract[] = V10_EDGE_CASE_MATRIX): string[] {
  const failures = validateV10StaticContractCoverage(matrix);
  for (const key of ["time", "concurrency", "multi_tab", "multi_org", "offline", "locale", "browser", "large_data"] as const) {
    if (!matrix.some((row) => row.key === key)) failures.push(`edge_case_missing:${key}`);
  }
  if (!v10StaticContractHasRequirement(matrix, "time", "dst_transition")) failures.push("time:dst_transition_required");
  if (!v10StaticContractHasRequirement(matrix, "concurrency", "idempotency_replay")) failures.push("concurrency:idempotency_replay_required");
  if (!v10StaticContractHasRequirement(matrix, "offline", "offline_retry")) failures.push("offline:offline_retry_required");
  if (!v10StaticContractHasRequirement(matrix, "large_data", "fifty_thousand_export_rows")) failures.push("large_data:export_scale_required");
  return failures;
}

export function validateV10TestTierExecutionContracts(
  contracts: readonly V10TestTierExecutionContract[] = V10_TEST_TIER_EXECUTION_CONTRACTS
): string[] {
  const failures: string[] = [];
  const requiredTiers: readonly V10TestTierExecutionContract["tier"][] = [
    "fast_unit",
    "focused_integration",
    "ui_component",
    "browser_e2e",
    "static_release",
    "release_candidate",
    "external_blocker",
  ];
  for (const tier of requiredTiers) {
    if (!contracts.some((contract) => contract.tier === tier)) failures.push(`test_tier_missing:${tier}`);
  }
  for (const contract of contracts) {
    if (!contract.command.startsWith("npm run ")) failures.push(`${contract.tier}:npm_command_required`);
    if (!contract.ciBlocking) failures.push(`${contract.tier}:ci_blocking_required`);
    if (contract.freshnessHours <= 0 || contract.freshnessHours > 24) failures.push(`${contract.tier}:freshness_24h_required`);
    if (contract.covers.length === 0) failures.push(`${contract.tier}:coverage_required`);
    if (contract.tier === "external_blocker" && contract.skipPolicy !== "external_evidence_required") {
      failures.push(`${contract.tier}:external_evidence_policy_required`);
    }
    if (contract.tier !== "external_blocker" && contract.skipPolicy === "external_evidence_required" && contract.tier !== "release_candidate") {
      failures.push(`${contract.tier}:unexpected_external_evidence_policy`);
    }
  }
  if (new Set(contracts.map((contract) => contract.tier)).size !== contracts.length) failures.push("test_tier_duplicate");
  return failures;
}

export function validateV10SupportAdminAccessRequest(request: V10SupportAdminAccessRequest, now = new Date()): string[] {
  const failures: string[] = [];
  if (!request.organizationId) failures.push("organization_scope_required");
  if (!request.actorId) failures.push("actor_required");
  if (!request.reason?.trim()) failures.push("reason_required");
  if (!request.auditEventId) failures.push("audit_event_required");
  if (request.accessLevel !== "user" && !request.supportSafeOnly) failures.push("support_access_must_be_support_safe");
  if (request.accessLevel === "service_role" && !request.approvedBy) failures.push("service_role_requires_approval");
  if (request.accessLevel === "break_glass") {
    if (!request.approvedBy) failures.push("break_glass_requires_approval");
    if (!request.expiresAt) failures.push("break_glass_expiry_required");
  }
  if (request.expiresAt && new Date(request.expiresAt) < now) failures.push("access_expired");
  return failures;
}

export function validateV10DisasterRecoveryDrill(drill: V10DisasterRecoveryDrill): string[] {
  const failures: string[] = [];
  if (!drill.owner) failures.push("owner_required");
  if (!drill.backupVerified) failures.push("backup_verification_required");
  if (!drill.restoreTested) failures.push("restore_test_required");
  if (!drill.replaySafe) failures.push("safe_replay_required");
  if (!drill.privateDataLeakCheckPassed) failures.push("privacy_leak_check_required");
  if (!drill.evidenceCapturedAt) failures.push("evidence_capture_required");
  return failures;
}

export function validateV10CanaryControlDecision(decision: V10CanaryControlDecision): string[] {
  const failures: string[] = [];
  const promotionStates = new Set(["beta_canary", "beta_broad", "GA_candidate", "GA"]);
  if (promotionStates.has(decision.state) && (decision.organizationScope?.length ?? 0) === 0) failures.push("organization_scope_required");
  if (promotionStates.has(decision.state) && !decision.metricsFresh) failures.push("fresh_metrics_required");
  if (promotionStates.has(decision.state) && !decision.killSwitchReady) failures.push("kill_switch_required");
  if ((decision.state === "GA_candidate" || decision.state === "GA") && !decision.rollbackReady) failures.push("rollback_readiness_required");
  if ((decision.unresolvedBlockers?.length ?? 0) > 0 && decision.state !== "paused" && decision.state !== "rolled_back") {
    failures.push("unresolved_blockers_must_pause_or_rollback");
  }
  if (decision.state === "GA" && !decision.ownerSignoff) failures.push("owner_signoff_required");
  return failures;
}

export function validateV10DataQualityRemediation(input: V10DataQualityRemediationInput): string[] {
  const failures: string[] = [];
  if (!input.visibleWorkCreated) failures.push("visible_work_required");
  if (!input.remediationAction) failures.push("remediation_action_required");
  if (!input.auditEventId) failures.push("audit_event_required");
  if (!input.telemetryOutcome) failures.push("telemetry_outcome_required");
  return failures;
}

export function validateV10OperatorRunbooks(runbooks: readonly V10OperatorRunbook[] = V10_OPERATOR_RUNBOOKS): string[] {
  const failures: string[] = [];
  for (const runbook of runbooks) {
    if (!runbook.key) failures.push("runbook_key_required");
    if (!runbook.trigger) failures.push(`${runbook.key}:trigger_required`);
    if (!runbook.diagnosticPrefix.startsWith("v10_")) failures.push(`${runbook.key}:v10_diagnostic_prefix_required`);
    if (!runbook.recoveryDestination.startsWith("/")) failures.push(`${runbook.key}:recovery_destination_required`);
    if (/raw contract|token|secret|signed url|customer name/i.test(runbook.customerSafeCopy)) {
      failures.push(`${runbook.key}:customer_safe_copy_violation`);
    }
  }
  for (const key of ["read_model_repair", "failed_job_retry", "provider_outage", "canary_hold", "release_rollback"]) {
    if (!runbooks.some((runbook) => runbook.key === key)) failures.push(`runbook_missing:${key}`);
  }
  return failures;
}

export function buildV10OperationalRecoveryManifest(input: {
  runbookKey: string;
  diagnosticSuffix?: string | null;
  artifactRevocation?: boolean;
}): V10OperationalRecoveryManifest | null {
  const runbook = V10_OPERATOR_RUNBOOKS.find((candidate) => candidate.key === input.runbookKey);
  if (!runbook) return null;
  const diagnosticSuffix = input.diagnosticSuffix?.trim() || "manual_review";
  return {
    runbook_key: runbook.key,
    owner: runbook.owner,
    diagnostic_id: `${runbook.diagnosticPrefix}_${diagnosticSuffix}`,
    recovery_destination: runbook.recoveryDestination,
    customer_safe_copy: runbook.customerSafeCopy,
    completion_proof: runbook.completionProof,
    requires_kill_switch_review: runbook.key === "canary_hold" || runbook.key === "release_rollback",
    requires_read_model_repair: runbook.key === "read_model_repair",
    requires_artifact_revocation: input.artifactRevocation === true,
  };
}

export function validateV10DataDictionary(entries: readonly V10DataDictionaryEntry[] = V10_DATA_DICTIONARY): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.source)) failures.push(`duplicate_source:${entry.source}`);
    seen.add(entry.source);
    if (entry.readModelTargets.length === 0 && entry.retentionClass !== "release_evidence") {
      failures.push(`${entry.source}:read_model_target_required`);
    }
    if (entry.fixtureTargets.length === 0) failures.push(`${entry.source}:fixture_target_required`);
    if (entry.retentionClass === "external_link_expiring" && entry.redactionPolicy !== "token_hash_only") {
      failures.push(`${entry.source}:external_link_token_hash_required`);
    }
    if (entry.retentionClass === "release_evidence" && entry.redactionPolicy !== "synthetic_only") {
      failures.push(`${entry.source}:release_evidence_must_be_synthetic`);
    }
  }
  return failures;
}

export function validateV10ProviderBoundaries(boundaries: readonly V10ProviderBoundaryContract[] = V10_PROVIDER_BOUNDARIES): string[] {
  const failures: string[] = [];
  for (const provider of ["supabase", "resend", "openai", "stripe", "vercel_cron", "storage", "malware_scan", "signed_url", "playwright"] as const) {
    if (!boundaries.some((boundary) => boundary.provider === provider)) failures.push(`provider_missing:${provider}`);
  }
  for (const boundary of boundaries) {
    if (boundary.requiredServerEnv.some((key) => key.startsWith("NEXT_PUBLIC_"))) {
      failures.push(`${boundary.provider}:server_secret_must_not_be_public`);
    }
    if (boundary.publicEnvAllowed.some((key) => !key.startsWith("NEXT_PUBLIC_"))) {
      failures.push(`${boundary.provider}:public_env_must_be_prefixed`);
    }
    if (!boundary.outageState.endsWith("_unavailable") && !boundary.outageState.endsWith("_unconfigured")) {
      failures.push(`${boundary.provider}:outage_state_required`);
    }
  }
  return failures;
}

export function buildV10ProviderReadinessSnapshot(
  env: Record<string, string | undefined>,
  boundaries: readonly V10ProviderBoundaryContract[] = V10_PROVIDER_BOUNDARIES
): V10ProviderReadinessSnapshot[] {
  return boundaries.map((boundary) => {
    const missingEnv = boundary.requiredServerEnv.filter((key) => !env[key]);
    return {
      provider: boundary.provider,
      ready: missingEnv.length === 0,
      missingEnv,
      outageState: missingEnv.length === 0 ? "none" : boundary.outageState,
      releaseBlocker: missingEnv.length > 0 && boundary.releaseBlockerWhenMissing,
      recoveryDestination: "/settings/health#providers",
    };
  });
}

export function validateV10OpsReleaseReadinessContracts(
  contracts: readonly V10OpsReleaseReadinessContract[] = V10_OPS_RELEASE_READINESS_CONTRACTS
): string[] {
  const failures: string[] = [];
  const providerSet = new Set(V10_PROVIDER_BOUNDARIES.map((boundary) => boundary.provider));
  const requiredKeys: readonly V10OpsReleaseReadinessContract["key"][] = [
    "read_model_refresh",
    "idempotency_cleanup",
    "runtime_artifact_cleanup",
    "provider_readiness",
    "slo_canary",
    "support_handoff",
    "rollback_repair",
  ];
  for (const key of requiredKeys) {
    if (!contracts.some((contract) => contract.key === key)) failures.push(`ops_readiness_missing:${key}`);
  }
  for (const contract of contracts) {
    if (contract.cronRoute && !contract.cronRoute.startsWith("src/app/api/cron/v10/")) {
      failures.push(`${contract.key}:cron_route_must_be_v10`);
    }
    if (!contract.diagnosticPrefix.startsWith("v10_")) failures.push(`${contract.key}:diagnostic_prefix_required`);
    if (contract.retentionDays <= 0) failures.push(`${contract.key}:retention_required`);
    if (!contract.sloDashboardKey) failures.push(`${contract.key}:slo_dashboard_required`);
    if (!contract.rollbackCommand.trim()) failures.push(`${contract.key}:rollback_command_required`);
    if (!contract.recoveryDestination.startsWith("/settings/health")) {
      failures.push(`${contract.key}:settings_health_recovery_required`);
    }
    const anchor = contract.recoveryDestination.split("#")[1];
    if (anchor && !V10_SETTINGS_HEALTH_RECOVERY_ANCHORS.includes(anchor as (typeof V10_SETTINGS_HEALTH_RECOVERY_ANCHORS)[number])) {
      failures.push(`${contract.key}:settings_health_anchor_missing:${anchor}`);
    }
    if (!contract.releaseEvidenceKey.startsWith("ops:")) failures.push(`${contract.key}:release_evidence_key_required`);
    for (const provider of contract.providerBlockers) {
      if (!providerSet.has(provider)) failures.push(`${contract.key}:unknown_provider_blocker:${provider}`);
    }
  }
  if (new Set(contracts.map((contract) => contract.key)).size !== contracts.length) failures.push("ops_readiness_duplicate");
  return failures;
}

export function validateV10SupportDiagnosticViews(views: readonly V10SupportDiagnosticView[] = V10_SUPPORT_DIAGNOSTIC_VIEWS): string[] {
  const failures: string[] = [];
  for (const view of views) {
    if (view.fields.length === 0) failures.push(`${view.key}:fields_required`);
    if (view.impersonationAllowed) failures.push(`${view.key}:impersonation_not_allowed`);
    if (!view.allowedAccessLevels.includes("support") && view.escalationOwner === "support") {
      failures.push(`${view.key}:support_owner_requires_support_access`);
    }
    if (!view.remediationCopy || /raw|token|secret|customer payload/i.test(view.remediationCopy)) {
      failures.push(`${view.key}:customer_safe_remediation_required`);
    }
    for (const field of view.prohibitedFields) {
      if (view.fields.includes(field)) failures.push(`${view.key}:prohibited_field_exposed:${field}`);
    }
  }
  return failures;
}

export function validateV10OperationalAlerts(alerts: readonly V10OperationalAlert[] = V10_OPERATIONAL_ALERTS): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const alert of alerts) {
    if (seen.has(alert.key)) failures.push(`duplicate_alert:${alert.key}`);
    seen.add(alert.key);
    if (!alert.diagnosticId.startsWith("v10_")) failures.push(`${alert.key}:diagnostic_id_required`);
    if (alert.audiences.length === 0) failures.push(`${alert.key}:audience_required`);
    if (!alert.recoveryDestination.startsWith("/")) failures.push(`${alert.key}:recovery_destination_required`);
    if (!alert.customerSafeCopy || /raw|token|secret|customer payload|signed url/i.test(alert.customerSafeCopy)) {
      failures.push(`${alert.key}:customer_safe_copy_required`);
    }
    if (alert.incidentState !== "none" && alert.incidentState !== "resolved" && alert.evidenceFreshness === "missing") {
      failures.push(`${alert.key}:active_incident_requires_evidence`);
    }
    if (alert.severity === "critical" && alert.incidentState === "none") failures.push(`${alert.key}:critical_incident_state_required`);
  }
  return failures;
}

export function validateV10AuditImmutabilityProbes(
  probes: readonly V10AuditImmutabilityProbe[] = V10_AUDIT_IMMUTABILITY_PROBES
): string[] {
  const failures: string[] = [];
  for (const probe of probes) {
    if (!probe.actorServerDerived) failures.push(`${probe.table}:actor_server_derived_required`);
    if (!probe.metadataSupportSafe) failures.push(`${probe.table}:support_safe_metadata_required`);
    if (!probe.evidenceKey.startsWith("audit:")) failures.push(`${probe.table}:audit_evidence_key_required`);
    if (probe.table === "v10_audit_events" && probe.operation !== "append") failures.push("v10_audit_events:append_only_required");
    if (probe.operation !== "append" && !probe.compensatingEventId?.includes(".")) {
      failures.push(`${probe.table}:compensating_event_required`);
    }
  }
  for (const table of ["v10_audit_events", "v10_release_evidence_records", "v10_mutation_idempotency", "v10_runtime_artifacts"] as const) {
    if (!probes.some((probe) => probe.table === table)) failures.push(`immutability_probe_missing:${table}`);
  }
  return failures;
}

export function validateV10PostGaDriftControls(
  controls: readonly V10PostGaDriftControl[] = V10_POST_GA_DRIFT_CONTROLS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const requiredKeys: readonly V10PostGaDriftControl["key"][] = [
    "post_ga_slo_7_day",
    "post_ga_slo_30_day",
    "read_model_drift",
    "route_catalog_drift",
    "telemetry_schema_drift",
    "audit_vocabulary_drift",
    "report_export_artifact_drift",
    "provider_config_drift",
    "fixture_staleness",
    "release_evidence_expiry",
    "incident_rollback_drill",
  ];
  for (const key of requiredKeys) {
    if (!controls.some((control) => control.key === key)) failures.push(`post_ga_control_missing:${key}`);
  }
  for (const control of controls) {
    if (seen.has(control.key)) failures.push(`duplicate_post_ga_control:${control.key}`);
    seen.add(control.key);
    if (!control.checkCommand.startsWith("npm run ") && !control.checkCommand.startsWith("node ")) {
      failures.push(`${control.key}:check_command_required`);
    }
    if (!control.dashboardKey.trim()) failures.push(`${control.key}:dashboard_key_required`);
    if (control.evidenceFreshnessHours <= 0 || control.evidenceFreshnessHours > 168) {
      failures.push(`${control.key}:freshness_window_required`);
    }
    if (!control.recoveryDestination.startsWith("/settings/health#")) {
      failures.push(`${control.key}:settings_health_recovery_required`);
    }
    if (!control.rollbackCommand.startsWith("npm run ") && !control.rollbackCommand.startsWith("node ")) {
      failures.push(`${control.key}:rollback_command_required`);
    }
    if (!control.supportSafeEscalation || /raw|token|secret|customer payload|credential/i.test(control.supportSafeEscalation)) {
      failures.push(`${control.key}:support_safe_escalation_required`);
    }
  }
  return failures;
}

export function validateV10ApiEnvironmentIntegrationContracts(
  contracts: readonly V10ApiEnvironmentIntegrationContract[] = V10_API_ENVIRONMENT_INTEGRATION_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const requiredKeys: readonly V10ApiEnvironmentIntegrationContract["key"][] = [
    "request_response_schema",
    "cache_policy",
    "environment_parity",
    "entitlement_billing_sync",
    "integration_boundary",
    "pagination_filtering_sorting",
    "version_compatibility",
    "concurrency_time_bounds",
  ];
  for (const key of requiredKeys) {
    if (!contracts.some((contract) => contract.key === key)) failures.push(`api_env_contract_missing:${key}`);
  }
  for (const contract of contracts) {
    if (seen.has(contract.key)) failures.push(`duplicate_api_env_contract:${contract.key}`);
    seen.add(contract.key);
    if (!contract.runtimeArtifact.startsWith("src/")) failures.push(`${contract.key}:runtime_artifact_required`);
    if (!contract.negativeTestArtifact.endsWith(".test.ts") && !contract.negativeTestArtifact.endsWith(".v10.test.ts")) {
      failures.push(`${contract.key}:negative_test_required`);
    }
    if (contract.cachePolicy !== "private_no_store" && contract.cachePolicy !== "static_safe") {
      failures.push(`${contract.key}:cache_policy_required`);
    }
    if (contract.requiredEnvKeys.some((key) => key.startsWith("NEXT_PUBLIC_") && /SECRET|KEY|TOKEN/i.test(key))) {
      failures.push(`${contract.key}:public_secret_env_forbidden`);
    }
    if (!contract.compatibilityBoundary.startsWith("v10_")) failures.push(`${contract.key}:compatibility_boundary_required`);
    if (!contract.releaseGate.startsWith("npm run ")) failures.push(`${contract.key}:release_gate_required`);
  }
  return failures;
}

export function validateV10DataLifecycleComplianceContracts(
  contracts: readonly V10DataLifecycleComplianceContract[] = V10_DATA_LIFECYCLE_COMPLIANCE_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const requiredOperations: readonly V10DataLifecycleComplianceContract["operation"][] = [
    "create",
    "update",
    "archive",
    "delete",
    "restore",
    "retention_expiry",
    "artifact_revocation",
    "external_link_revocation",
    "fixture_teardown",
    "audit_retention",
    "release_evidence_expiry",
    "support_diagnostic_expiration",
    "dsar_delete_request",
  ];
  for (const operation of requiredOperations) {
    if (!contracts.some((contract) => contract.operation === operation)) failures.push(`lifecycle_operation_missing:${operation}`);
  }
  for (const contract of contracts) {
    if (seen.has(contract.operation)) failures.push(`duplicate_lifecycle_operation:${contract.operation}`);
    seen.add(contract.operation);
    if (!contract.retentionPolicy.trim()) failures.push(`${contract.operation}:retention_policy_required`);
    if (!contract.auditAction.includes(".")) failures.push(`${contract.operation}:audit_action_required`);
    if (!contract.supportBoundary.trim()) failures.push(`${contract.operation}:support_boundary_required`);
    if (!contract.customerSafeDiagnostic || /raw|token|secret|customer payload|credential/i.test(contract.customerSafeDiagnostic)) {
      failures.push(`${contract.operation}:customer_safe_diagnostic_required`);
    }
    if (!contract.cleanupCommand.startsWith("npm run ") && !contract.cleanupCommand.startsWith("node ")) {
      failures.push(`${contract.operation}:cleanup_command_required`);
    }
    if (!contract.complianceEvidenceKey.startsWith("compliance:")) {
      failures.push(`${contract.operation}:compliance_evidence_key_required`);
    }
    if (contract.operation.includes("link") && contract.privacyRedaction !== "token_hash_only") {
      failures.push(`${contract.operation}:token_hash_redaction_required`);
    }
    if (contract.operation.includes("fixture") && contract.privacyRedaction !== "synthetic_only") {
      failures.push(`${contract.operation}:synthetic_fixture_required`);
    }
  }
  return failures;
}

export function validateV10LegacyBridgeDecommissionContracts(
  contracts: readonly V10LegacyBridgeDecommissionContract[] = V10_LEGACY_BRIDGE_DECOMMISSION_CONTRACTS
): string[] {
  const failures: string[] = [];
  for (const contract of contracts) {
    if (!contract.replacementArtifact.trim()) failures.push(`${contract.bridge}:replacement_artifact_required`);
    if (!contract.runtimeUsageCheck.startsWith("npm run ")) failures.push(`${contract.bridge}:runtime_usage_check_required`);
    if (!contract.removalGate.trim()) failures.push(`${contract.bridge}:removal_gate_required`);
    if (!contract.rollbackPlan.trim()) failures.push(`${contract.bridge}:rollback_plan_required`);
    if (!contract.compatibilityBoundary.trim()) failures.push(`${contract.bridge}:compatibility_boundary_required`);
  }
  for (const bridge of ["v4_actions", "v6_settings", "v8_surface_guard", "v9_telemetry", "legacy_report_pack"] as const) {
    if (!contracts.some((contract) => contract.bridge === bridge)) failures.push(`legacy_bridge_missing:${bridge}`);
  }
  return failures;
}

export function validateV10ObservabilityPerformanceA11yContracts(
  contracts: readonly V10ObservabilityPerformanceA11yContract[] = V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS
): string[] {
  const failures: string[] = [];
  const requiredSurfaces: readonly V10ObservabilityPerformanceA11yContract["surface"][] = [
    "home",
    "work",
    "contract_record",
    "command_palette",
    "reports_exports",
    "settings_health",
  ];
  for (const surface of requiredSurfaces) {
    if (!contracts.some((contract) => contract.surface === surface)) failures.push(`surface_missing:${surface}`);
  }
  for (const contract of contracts) {
    if (contract.telemetrySignals.length === 0) failures.push(`${contract.surface}:telemetry_signal_required`);
    if (!contract.telemetrySignals.every((signal) => signal.startsWith("product.v10."))) {
      failures.push(`${contract.surface}:telemetry_signal_must_be_v10`);
    }
    if (contract.alertThresholds.length === 0) failures.push(`${contract.surface}:alert_threshold_required`);
    if (!contract.performanceBudgets.some((budget) => /ms|row|threshold|paginated|queued/i.test(budget))) {
      failures.push(`${contract.surface}:performance_budget_required`);
    }
    if (!contract.accessibilityStates.some((state) => /focus|announced|trap|descendant/i.test(state))) {
      failures.push(`${contract.surface}:accessibility_state_required`);
    }
    if (!contract.scaleFixture) failures.push(`${contract.surface}:scale_fixture_required`);
    if (!contract.supportDiagnosticFields.includes("diagnostic_id")) failures.push(`${contract.surface}:diagnostic_id_field_required`);
  }
  if (new Set(contracts.map((contract) => contract.surface)).size !== contracts.length) failures.push("surface_duplicate");
  return failures;
}

export function buildV10SupportAdminVisibilityRows(
  accessLevel: V10SupportAccessLevel,
  alerts: readonly V10OperationalAlert[] = V10_OPERATIONAL_ALERTS
): V10SupportAdminVisibilityRow[] {
  const adminAccess = accessLevel === "admin" || accessLevel === "service_role" || accessLevel === "break_glass";
  const supportAccess = adminAccess || accessLevel === "support";
  return alerts
    .filter((alert) => {
      if (adminAccess) return alert.audiences.includes("admin") || alert.audiences.includes("operator");
      if (supportAccess) return alert.audiences.includes("support");
      return false;
    })
    .map((alert) => ({
      key: alert.key,
      severity: alert.severity,
      incident_state: alert.incidentState,
      evidence_freshness: alert.evidenceFreshness,
      escalation_owner: alert.escalationOwner,
      recovery_destination: alert.recoveryDestination,
      customer_safe_copy: alert.customerSafeCopy,
      diagnostic_id: supportAccess ? alert.diagnosticId : null,
    }));
}

export function getV10OperationalAlertForDiagnostic(diagnosticId: string): V10OperationalAlert | null {
  return V10_OPERATIONAL_ALERTS.find((alert) => alert.diagnosticId === diagnosticId) ?? null;
}

export function validateV10DestructiveOperationContracts(
  contracts: readonly V10DestructiveOperationContract[] = V10_DESTRUCTIVE_OPERATION_CONTRACTS
): string[] {
  const failures: string[] = [];
  for (const operation of ["archive_contract", "delete_contract", "restore_contract", "revoke_export_artifact", "revoke_evidence_link", "cancel_job", "retry_job", "release_rollback", "incident_kill_switch"] as const) {
    if (!contracts.some((contract) => contract.operation === operation)) failures.push(`operation_missing:${operation}`);
  }
  for (const contract of contracts) {
    if (!contract.requiresAudit) failures.push(`${contract.operation}:audit_required`);
    if (!contract.requiresIdempotency) failures.push(`${contract.operation}:idempotency_required`);
    if ((contract.operation.includes("delete") || contract.operation.includes("revoke") || contract.operation.includes("rollback") || contract.operation.includes("kill_switch")) && !contract.requiresReason) {
      failures.push(`${contract.operation}:reason_required`);
    }
    if (!contract.customerSafeWarning || /permanent secret|token|raw/i.test(contract.customerSafeWarning)) {
      failures.push(`${contract.operation}:customer_safe_warning_required`);
    }
  }
  return failures;
}

export function validateV10StateTransition(machineName: string, from: string, to: string): string[] {
  const machine = V10_STATE_MACHINES.find((candidate) => candidate.name === machineName);
  if (!machine) return ["unknown_state_machine"];
  const failures: string[] = [];
  if (!machine.states.includes(from)) failures.push("unknown_from_state");
  if (!machine.states.includes(to)) failures.push("unknown_to_state");
  if (machine.terminalStates.includes(from)) failures.push("terminal_state_cannot_transition");
  return failures;
}

export function getV10StateActionAvailability(machineName: string, state: string): readonly string[] {
  const machine = V10_STATE_MACHINES.find((candidate) => candidate.name === machineName);
  return machine?.actionAvailability[state] ?? [];
}

export function getV10NoActionExplanation(machineName: string, state: string): string | null {
  const machine = V10_STATE_MACHINES.find((candidate) => candidate.name === machineName);
  return machine?.noActionExplanations[state] ?? null;
}

export function validateV10StateMachineCompleteness(): string[] {
  const failures: string[] = [];
  for (const machine of V10_STATE_MACHINES) {
    for (const terminal of machine.terminalStates) {
      if (!machine.noActionExplanations[terminal]) failures.push(`${machine.name}:${terminal}:no_action_explanation_required`);
    }
    for (const transition of [...machine.auditTransitions, ...machine.rollbackTransitions]) {
      const [from, to] = transition.split("->");
      if (!from || !to) {
        failures.push(`${machine.name}:invalid_transition:${transition}`);
        continue;
      }
      if (!machine.states.includes(from)) failures.push(`${machine.name}:unknown_transition_from:${from}`);
      if (!machine.states.includes(to)) failures.push(`${machine.name}:unknown_transition_to:${to}`);
    }
  }
  return failures;
}

export function validateV10OperationalRunbookCoverage(
  rows: readonly V10OperationalRunbookCoverage[] = V10_OPERATIONAL_RUNBOOK_COVERAGE
): string[] {
  const failures: string[] = [];
  const required: readonly V10OperationalRunbookCoverage["key"][] = [
    "read_model_rebuild",
    "idempotency_cleanup",
    "runtime_artifact_cleanup",
    "fixture_teardown",
    "failed_report_recovery",
    "failed_export_recovery",
    "failed_import_recovery",
    "evidence_escalation",
    "notification_failure",
    "audit_write_failure",
  ];
  for (const key of required) {
    if (!rows.some((row) => row.key === key)) failures.push(`runbook_coverage_missing:${key}`);
  }
  for (const row of rows) {
    if (!row.trigger.trim()) failures.push(`${row.key}:trigger_required`);
    if (!row.command.startsWith("npm run ") && !row.command.startsWith("node ")) failures.push(`${row.key}:command_required`);
    if (!row.recoveryDestination.startsWith("/")) failures.push(`${row.key}:recovery_destination_required`);
    if (!row.releaseEvidenceKey.startsWith("ops:")) failures.push(`${row.key}:release_evidence_key_required`);
    if (!row.supportSafe) failures.push(`${row.key}:support_safe_required`);
    if (!row.incidentReadinessCheck.trim()) failures.push(`${row.key}:incident_readiness_check_required`);
  }
  if (new Set(rows.map((row) => row.key)).size !== rows.length) failures.push("runbook_coverage_duplicate");
  return failures;
}

export function validateV10QualityMatrix(rows: readonly V10QualityMatrixRow[] = V10_QUALITY_MATRIX): string[] {
  const failures: string[] = [];
  const required: readonly V10QualityMatrixRow["surface"][] = [
    "home",
    "work",
    "contracts",
    "contract_detail",
    "review",
    "renewals",
    "obligations",
    "evidence",
    "approvals",
    "exceptions",
    "reports",
    "settings",
    "command_palette",
    "external_evidence_submission",
  ];
  for (const surface of required) {
    if (!rows.some((row) => row.surface === surface)) failures.push(`quality_surface_missing:${surface}`);
  }
  for (const row of rows) {
    if (row.accessibilityCoverage.length === 0) failures.push(`${row.surface}:accessibility_required`);
    if (row.keyboardCoverage.length === 0) failures.push(`${row.surface}:keyboard_required`);
    if (row.screenReaderCoverage.length === 0) failures.push(`${row.surface}:screen_reader_required`);
    if (!row.responsiveViewports.includes("320") && !row.responsiveViewports.includes("375")) {
      failures.push(`${row.surface}:mobile_viewport_required`);
    }
    if (!row.responsiveViewports.includes("768")) failures.push(`${row.surface}:tablet_viewport_required`);
    if (!/ms|row|paginated|handoff/i.test(row.performanceBudget)) failures.push(`${row.surface}:performance_budget_required`);
    for (const browser of ["chromium", "webkit", "firefox"] as const) {
      if (!row.browserCoverage.includes(browser)) failures.push(`${row.surface}:browser_required:${browser}`);
    }
    if (!row.visualRegressionSmoke) failures.push(`${row.surface}:visual_regression_smoke_required`);
    if (!row.evidenceKey.startsWith("quality:")) failures.push(`${row.surface}:quality_evidence_key_required`);
  }
  if (new Set(rows.map((row) => row.surface)).size !== rows.length) failures.push("quality_surface_duplicate");
  return failures;
}

export function validateV10FinalCutoverChecklist(
  rows: readonly V10FinalCutoverChecklistRow[] = V10_FINAL_CUTOVER_CHECKLIST
): string[] {
  const failures: string[] = [];
  const required: readonly V10FinalCutoverChecklistRow["key"][] = [
    "no_exclusions_matrix",
    "fixture_manifest_freeze",
    "beta_promotion",
    "ga_promotion",
    "complete_promotion",
    "legacy_boundary_decisions",
    "hidden_p1_p2_security",
    "included_p2_runtime",
    "unclassified_requirement_sweep",
    "final_handoff",
  ];
  for (const key of required) {
    if (!rows.some((row) => row.key === key)) failures.push(`cutover_check_missing:${key}`);
  }
  for (const row of rows) {
    if (!row.gateCommand.startsWith("npm run ") && !row.gateCommand.startsWith("node ")) {
      failures.push(`${row.key}:gate_command_required`);
    }
    if (!row.blocksPromotion) failures.push(`${row.key}:must_block_promotion`);
    if (!row.evidenceKey.startsWith("cutover:")) failures.push(`${row.key}:cutover_evidence_key_required`);
    if (row.key === "complete_promotion" && row.releaseState !== "complete") {
      failures.push("complete_promotion:complete_state_required");
    }
    if (row.residualRiskPolicy === "monitor_post_ga" && row.releaseState !== "complete") {
      failures.push(`${row.key}:monitor_post_ga_requires_complete_state`);
    }
  }
  if (new Set(rows.map((row) => row.key)).size !== rows.length) failures.push("cutover_check_duplicate");
  return failures;
}
