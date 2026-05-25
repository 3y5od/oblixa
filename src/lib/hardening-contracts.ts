import { OPS_ARTIFACT_RUNBOOK } from "./spec-artifact-ids";

export type V10HardeningContract = {
  key: string;
  requirements: readonly string[];
};

export type V10ScriptedQaScenario = {
  scenario_id: string;
  fixture_id: string;
  route_or_action: string;
  expected_state: string;
  observed_state: string | null;
  diagnostic_id: string | null;
  audit_event_id: string | null;
  telemetry_or_evidence_key: string | null;
  artifact_ref: string | null;
  blocker: string | null;
  state_changing?: boolean;
};

export type V10AdversarialRouteActionScenario = {
  scenario_id: string;
  route_or_action: string;
  adversary:
    | "cross_tenant"
    | "forged_org"
    | "stale_version"
    | "idempotency_replay"
    | "hidden_module"
    | "plan_denial"
    | "revoked_link"
    | "unsafe_export"
    | "malformed_payload"
    | "cron_auth";
  expected_status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429;
  expected_outcome: string;
  diagnostic_id: string;
  audit_required: boolean;
  idempotency_required: boolean;
};

export type V10RuntimeArtifactPrivacyInput = {
  artifactKind: string;
  classification: string;
  accessScope: string;
  href?: string | null;
  checksum?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  visibilityState?: string | null;
};

export type V10TenantIsolationDecision = {
  actorOrganizationId: string | null;
  targetOrganizationId: string | null;
  targetExists: boolean | null;
  responseStatus: number;
  outcome: string;
  diagnosticId: string | null;
  cacheControl: string | null;
  supportSafeMetadata: Record<string, string | number | boolean | null>;
};

export type V10FoundationSecurityPrivacyContract = {
  key:
    | "tenant_isolation"
    | "eligibility"
    | "audit_metadata"
    | "cache_headers"
    | "support_diagnostics"
    | "external_artifacts";
  enforcedBy: readonly string[];
  requiredOutcomes: readonly string[];
  forbiddenSignals: readonly string[];
  releaseProof: "unit" | "api" | "release_check";
};

export type V10ServiceRoleBoundaryContract = {
  artifact: string;
  operation: "read" | "write" | "rpc" | "cron";
  tables: readonly string[];
  organizationPredicate: string | null;
  serviceRoleJustification: string;
  cachePolicy: "private_no_store" | "not_applicable";
  auditRequired: boolean;
  supportSafeDiagnostics: boolean;
};

export type V10ProviderIntegrationBoundaryContract = {
  provider: "supabase" | "vercel" | "resend" | "openai" | "stripe" | "playwright" | "vitest" | "semgrep";
  owner: string;
  readinessArtifacts: readonly string[];
  degradedState: string;
  privacyBoundary: readonly string[];
  releaseBlockerKey: string;
  fallbackBehavior: string;
};

export type V10AbusePrivacyScaleSurface = {
  surface: string;
  abuseCases: readonly string[];
  privacyLifecycle: readonly string[];
  scaleBudgets: readonly string[];
  concurrencyCases: readonly string[];
  retentionCases: readonly string[];
  cacheFocusCases: readonly string[];
};

export type V10DatabaseHardeningContract = {
  table: string;
  rlsRequired: boolean;
  uniqueIdentity: readonly string[];
  requiredIndexes: readonly string[];
  retentionRule: string | null;
  cleanupRoutine: string | null;
  repairPath: string | null;
};

export type V10NegativeRiskCategory =
  | "authorization"
  | "privacy"
  | "concurrency"
  | "stale_data"
  | "retries"
  | "large_result";

export type V10NegativeRiskTestPlan = {
  category: V10NegativeRiskCategory;
  scenarioIds: readonly string[];
  expectedFailureModes: readonly string[];
  requiredProof: readonly ("unit" | "api" | "ui" | "e2e" | "release_check")[];
  supportSafeDiagnosticRequired: boolean;
};

export type V10StrictnessMode =
  | "local"
  | "ci"
  | "release_candidate"
  | "post_ga"
  | "beta"
  | "GA"
  | "complete";

export type V10StrictnessModeGate = {
  mode: V10StrictnessMode;
  requiredCommands: readonly string[];
  requiredEvidence: readonly ("local_automation" | "release_evidence" | "external_dashboard")[];
  failurePolicy: "warn_only_local" | "fail_ci" | "block_promotion" | "hold_release";
};

export type V10QualitySecurityCiCoverageCategory =
  | "unit"
  | "api"
  | "ui"
  | "e2e"
  | "migration"
  | "failure_injection"
  | "security"
  | "privacy"
  | "accessibility"
  | "responsive"
  | "performance"
  | "release_evidence";

export type V10QualitySecurityCiCoverageGate = {
  category: V10QualitySecurityCiCoverageCategory;
  command: string;
  artifacts: readonly string[];
  blocksCi: boolean;
  blocksPromotion: boolean;
  runtimeEvidenceRequired: boolean;
  failureModeCovered: boolean;
};

export type V10LegacyProofCutoverContract = {
  legacyArtifact: string;
  proofPath: "descriptor_fixture" | "static_contract" | "v9_legacy" | "environment_gate";
  cutoverAction: "retire" | "quarantine";
  replacementEvidenceKey: `v10-${string}`;
  replacementCommand: string;
  allowedOnlyAfterRuntimeProof: boolean;
  testsPreserved: boolean;
  rollbackArtifact: string;
};

export const V10_PRIVACY_SAFE_COPY_CATALOG = {
  statuses: {
    failed_retryable: "Something stopped before completion. Retry from the same scope.",
    failed_terminal: "This cannot be retried safely. Open support-safe diagnostics.",
    hidden_module: "This feature is hidden by workspace settings.",
    no_action_available: "No action is available from your current role, plan, or workspace mode.",
  },
  actions: {
    retry_job: "Retry job",
    open_support_diagnostics: "Open diagnostics",
    request_access: "Request access",
    change_filters: "Change filters",
  },
  diagnostics: {
    diagnostic_id: "Diagnostic ID",
    evidence_status: "Evidence status",
    source_record: "Source record",
    no_sensitive_payloads: "Diagnostics do not include private contract text, tokens, or secrets.",
  },
} as const;

export const V10_STRICTNESS_MODES: Record<
  V10StrictnessMode,
  { requireLocalAutomation: boolean; requireReleaseEvidence: boolean; requireExternalDashboard: boolean }
> = {
  local: { requireLocalAutomation: true, requireReleaseEvidence: false, requireExternalDashboard: false },
  ci: { requireLocalAutomation: true, requireReleaseEvidence: false, requireExternalDashboard: false },
  beta: { requireLocalAutomation: true, requireReleaseEvidence: true, requireExternalDashboard: false },
  release_candidate: { requireLocalAutomation: true, requireReleaseEvidence: true, requireExternalDashboard: true },
  GA: { requireLocalAutomation: true, requireReleaseEvidence: true, requireExternalDashboard: true },
  complete: { requireLocalAutomation: true, requireReleaseEvidence: true, requireExternalDashboard: true },
  post_ga: { requireLocalAutomation: true, requireReleaseEvidence: true, requireExternalDashboard: true },
};

export const V10_STRICTNESS_MODE_GATES: readonly V10StrictnessModeGate[] = [
  {
    mode: "local",
    requiredCommands: ["npm run check:release-suite-current"],
    requiredEvidence: ["local_automation"],
    failurePolicy: "warn_only_local",
  },
  {
    mode: "ci",
    requiredCommands: ["npm run check:release-suite-current", "npm run check:release-privacy-scan"],
    requiredEvidence: ["local_automation"],
    failurePolicy: "fail_ci",
  },
  {
    mode: "beta",
    requiredCommands: ["npm run check:release-suite-current", "npm run check:release-evidence"],
    requiredEvidence: ["local_automation", "release_evidence"],
    failurePolicy: "block_promotion",
  },
  {
    mode: "release_candidate",
    requiredCommands: ["npm run check:release-suite-current", "npm run check:release-evidence", "npm run test:e2e:current-product"],
    requiredEvidence: ["local_automation", "release_evidence", "external_dashboard"],
    failurePolicy: "hold_release",
  },
  {
    mode: "GA",
    requiredCommands: ["npm run check:release-suite-current", "npm run check:release-evidence", "npm run test:e2e:current-product"],
    requiredEvidence: ["local_automation", "release_evidence", "external_dashboard"],
    failurePolicy: "hold_release",
  },
  {
    mode: "complete",
    requiredCommands: ["npm run check:release-suite-current", "npm run check:release-evidence", "npm run lint", "npm run typecheck"],
    requiredEvidence: ["local_automation", "release_evidence", "external_dashboard"],
    failurePolicy: "hold_release",
  },
  {
    mode: "post_ga",
    requiredCommands: ["npm run check:release-evidence"],
    requiredEvidence: ["release_evidence", "external_dashboard"],
    failurePolicy: "hold_release",
  },
] as const;

export const V10_EVIDENCE_DEPENDENCY_GRAPH: readonly V10HardeningContract[] = [
  { key: "fixtures", requirements: ["data_dictionary", "stable_requirement_ids", "privacy_scan"] },
  { key: "metrics", requirements: ["fixtures", "fixed_denominator", "sample_lock"] },
  { key: "performance", requirements: ["fixtures", "large_workspace", "dashboard_budget"] },
  { key: "accessibility", requirements: ["route_state_matrix", "browser_harness", "manual_exception_record"] },
  { key: "readiness", requirements: ["metrics", "performance", "accessibility", "audit_integrity"] },
  { key: "release_artifacts", requirements: ["readiness", "communication_safety", "archive_policy"] },
] as const;

export const V10_REQUIREMENT_ID_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "ids", requirements: ["stable", "section_scoped", "priority_encoded", "artifact_mapped", "never_reused"] },
  { key: "data_dictionary", requirements: ["owner", "source_table_or_mapper", "privacy_class", "retention_class", "release_fixture_field"] },
  { key: "customer_impact", requirements: ["activation", "work_reachability", "renewal_prevention", "evidence_accountability", "report_export_reliability"] },
  { key: "rollback_metrics", requirements: ["error_budget_burn", "failed_job_rate", "mutation_conflict_rate", "support_escalation_rate"] },
  { key: "release_communication", requirements: ["no_customer_names", "no_contract_text", "no_private_urls", "known_limitations_reviewed"] },
] as const;

export const V10_INVARIANT_GENERATION_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "enums", requirements: ["no_duplicate_values", "exhaustive_labels", "route_state_coverage"] },
  { key: "catalogs", requirements: ["unique_keys", "privacy_safe_copy", "traceability_row"] },
  { key: "read_models", requirements: ["shared_fields", "visibility_state", "freshness_field", "source_links"] },
  { key: "mutations", requirements: ["idempotency", "audit_action", "outcome_mapping", "diagnostic_id"] },
  { key: "release_rows", requirements: ["strictness_mode", "evidence_source", "owner", "freshness_window"] },
] as const;

export const V10_ADVERSARIAL_TEST_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "helpers", requirements: ["nullish_inputs", "timezone_boundaries", "currency_mismatch", "large_counts"] },
  { key: "routes", requirements: ["malformed_query", "forged_org", "hidden_destination", "archived_target"] },
  { key: "mutations", requirements: ["duplicate_key", "stale_version", "payload_conflict", "cross_actor_reuse"] },
  { key: "evidence", requirements: ["expired_token", "revoked_token", "oversized_upload", "missing_required_note"] },
  { key: "artifacts", requirements: ["csv_formula", "unsafe_filename", "stale_signed_url", "tampered_manifest"] },
] as const;

export const V10_ADVERSARIAL_ROUTE_ACTION_SCENARIOS: readonly V10AdversarialRouteActionScenario[] = [
  {
    scenario_id: "cross_tenant_contract_export_denied",
    route_or_action: "/api/export/contracts",
    adversary: "cross_tenant",
    expected_status: 404,
    expected_outcome: "not_found",
    diagnostic_id: "v10_cross_tenant_export_denied",
    audit_required: true,
    idempotency_required: true,
  },
  {
    scenario_id: "forged_org_import_retry_denied",
    route_or_action: "/api/import/contracts/[jobId]",
    adversary: "forged_org",
    expected_status: 404,
    expected_outcome: "not_found",
    diagnostic_id: "v10_forged_org_import_retry_denied",
    audit_required: true,
    idempotency_required: true,
  },
  {
    scenario_id: "stale_task_expected_version_conflict",
    route_or_action: "src/actions/tasks.ts:updateContractTaskStatus",
    adversary: "stale_version",
    expected_status: 409,
    expected_outcome: "stale_version",
    diagnostic_id: "v10_task_stale_version",
    audit_required: true,
    idempotency_required: true,
  },
  {
    scenario_id: "duplicate_idempotency_payload_conflict",
    route_or_action: "/api/report-packs",
    adversary: "idempotency_replay",
    expected_status: 409,
    expected_outcome: "conflict",
    diagnostic_id: "v10_idempotency_payload_conflict",
    audit_required: true,
    idempotency_required: true,
  },
  {
    scenario_id: "hidden_assurance_module_search_non_leakage",
    route_or_action: "/api/command-palette/contracts",
    adversary: "hidden_module",
    expected_status: 404,
    expected_outcome: "hidden_module",
    diagnostic_id: "v10_hidden_module_search_non_leakage",
    audit_required: false,
    idempotency_required: false,
  },
  {
    scenario_id: "core_plan_report_pack_denied",
    route_or_action: "/api/report-packs",
    adversary: "plan_denial",
    expected_status: 403,
    expected_outcome: "plan_required",
    diagnostic_id: "v10_report_plan_required",
    audit_required: true,
    idempotency_required: true,
  },
  {
    scenario_id: "revoked_external_evidence_link_denied",
    route_or_action: "/api/evidence/submit",
    adversary: "revoked_link",
    expected_status: 410,
    expected_outcome: "external_link_revoked",
    diagnostic_id: "v10_external_evidence_link_revoked",
    audit_required: true,
    idempotency_required: true,
  },
  {
    scenario_id: "unsafe_csv_formula_export_redacted",
    route_or_action: "/api/export/contracts",
    adversary: "unsafe_export",
    expected_status: 422,
    expected_outcome: "dependency_blocked",
    diagnostic_id: "v10_unsafe_export_formula_blocked",
    audit_required: true,
    idempotency_required: true,
  },
  {
    scenario_id: "malformed_evidence_action_payload",
    route_or_action: "/api/evidence/[id]/[action]",
    adversary: "malformed_payload",
    expected_status: 400,
    expected_outcome: "validation_failed",
    diagnostic_id: "v10_malformed_evidence_payload",
    audit_required: false,
    idempotency_required: true,
  },
  {
    scenario_id: "cron_wrong_secret_rejected",
    route_or_action: "/api/cron/v4/evidence-followup",
    adversary: "cron_auth",
    expected_status: 401,
    expected_outcome: "unauthorized",
    diagnostic_id: "v10_cron_unauthorized",
    audit_required: false,
    idempotency_required: false,
  },
] as const;


export const V10_PERSONA_WORKSPACE_COVERAGE: readonly V10HardeningContract[] = [
  { key: "personas", requirements: ["admin", "manager", "legal_reviewer", "finance_reviewer", "editor", "viewer", "external_responder"] },
  { key: "workspace_sizes", requirements: ["empty", "small", "medium", "large", "enterprise"] },
  { key: "workspace_modes", requirements: ["core", "advanced", "assurance"] },
  { key: "plans", requirements: ["trial", "core", "advanced", "assurance", "past_due"] },
  { key: "degraded_states", requirements: ["provider_outage", "queue_backlog", "partial_job", "stale_read_model", "hidden_module"] },
] as const;

export const V10_RECONCILIATION_JOB_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "read_model_repair", requirements: ["detect_stale_rows", "dry_run", "repair_report", "audit_event"] },
  { key: "count_repair", requirements: ["home_work_report_delta", "notification_delta", "search_delta", "release_metric_delta"] },
  { key: "generated_work_integrity", requirements: ["dedupe_key_check", "orphan_source_check", "lifecycle_repair", "diagnostic_id"] },
  { key: "drift_detection", requirements: ["schema_snapshot", "catalog_snapshot", "route_snapshot", "fixture_snapshot"] },
] as const;

export const V10_API_SNAPSHOT_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "response_shapes", requirements: ["success", "validation_failed", "unauthorized", "forbidden", "not_found", "conflict"] },
  { key: "compatibility", requirements: ["legacy_fields_preserved", "v10_envelope_additive", "cache_headers", "private_error_copy"] },
  { key: "fixtures", requirements: ["core", "advanced", "assurance", "hidden_module", "large_workspace"] },
] as const;

export const V10_NOTIFICATION_DEDUPE_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "throttling", requirements: ["per_user", "per_record", "per_channel", "quiet_hours", "workspace_timezone"] },
  { key: "dedupe", requirements: ["stable_dedupe_key", "source_object", "notification_class", "delivery_window"] },
  { key: "resend", requirements: ["manual_resend_audited", "unsubscribe_respected", "suppression_reason", "delivery_retry_state"] },
  { key: "oversend_prevention", requirements: ["max_attempts", "provider_backoff", "incident_circuit_breaker", "dashboard_metric"] },
] as const;

export const V10_ERROR_BUDGET_AUDIT_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "error_budget", requirements: ["slo_key", "burn_rate", "budget_window", "release_blocking_threshold"] },
  { key: "audit_immutability", requirements: ["append_only", "hash_chain_or_equivalent", "actor_server_derived", "no_payload_mutation"] },
  { key: "tamper_detection", requirements: ["fixture_manifest_hash", "metric_run_hash", "artifact_checksum", "promotion_signature"] },
  { key: "readiness_integrity", requirements: ["evidence_freshness", "dashboard_freshness", "manual_exception_approval", "rollback_threshold"] },
] as const;

export const V10_DEPENDENCY_SUPPLY_CHAIN_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "stack_preservation", requirements: ["nextjs_supabase_vitest_playwright", "no_new_infrastructure_without_evidence", "package_lock_required"] },
  { key: "package_scripts", requirements: ["check_v10_suite", "check_v10_release_evidence", "check_v10_privacy_scan", "typecheck", "lint", "test_e2e_v10"] },
  { key: "artifact_integrity", requirements: ["sbom_script", "audit_script", "ci_provenance", "artifact_secret_scan"] },
  { key: "dependency_changes", requirements: ["review_reason", "license_check", "supply_chain_risk", "rollback_path"] },
] as const;

export const V10_DEPRECATION_CLEANUP_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "v9_v10_overlap", requirements: ["preserve_v9_tests", "v10_supersession_reason", "legacy_fallback_boundary"] },
  { key: "stale_docs", requirements: ["docs_non_authoritative", "shipped_behavior_reference", "release_evidence_reference"] },
  { key: "obsolete_scripts", requirements: ["replacement_command", "retirement_reason", "ci_reference_removed"] },
  { key: "placeholder_contracts", requirements: ["classified_blocker", "owner", "evidence_needed", "release_state_impact"] },
] as const;

export const V10_LEGACY_PROOF_CUTOVER_CONTRACTS: readonly V10LegacyProofCutoverContract[] = [
  {
    legacyArtifact: "descriptor fixture objective rows",
    proofPath: "descriptor_fixture",
    cutoverAction: "quarantine",
    replacementEvidenceKey: "v10-release:objective-metric:all",
    replacementCommand: "npm run report:runtime-evidence-plan",
    allowedOnlyAfterRuntimeProof: true,
    testsPreserved: true,
    rollbackArtifact: "src/lib/objective-measurements.test.ts",
  },
  {
    legacyArtifact: "static acceptance matrix completion claims",
    proofPath: "static_contract",
    cutoverAction: "quarantine",
    replacementEvidenceKey: "v10-promotability:complete",
    replacementCommand: "npm run check:release-promotable",
    allowedOnlyAfterRuntimeProof: true,
    testsPreserved: true,
    rollbackArtifact: "src/lib/promotability.test.ts",
  },
  {
    legacyArtifact: "v9 release-contract bridge",
    proofPath: "v9_legacy",
    cutoverAction: "retire",
    replacementEvidenceKey: "v10-release:promotion-decision:complete",
    replacementCommand: "npm run check:complete-closure",
    allowedOnlyAfterRuntimeProof: true,
    testsPreserved: true,
    rollbackArtifact: "src/lib/compatibility-release-contract.ts",
  },
  {
    legacyArtifact: "provider console readiness notes",
    proofPath: "environment_gate",
    cutoverAction: "quarantine",
    replacementEvidenceKey: "v10-release:external-blocker:provider-configuration",
    replacementCommand: "npm run check:release-evidence -- --external-blockers none",
    allowedOnlyAfterRuntimeProof: true,
    testsPreserved: true,
    rollbackArtifact: OPS_ARTIFACT_RUNBOOK,
  },
] as const;

export const V10_SUPPORT_DOC_BOUNDARY_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "support_runbooks", requirements: ["diagnostic_id", "safe_copy", "recovery_destination", "no_private_payloads"] },
  { key: "operator_notes", requirements: ["shipped_behavior_link", "audit_visibility", "release_evidence_status", "not_completion_proof"] },
  { key: "known_limitations", requirements: ["blocker_key", "owner", "mitigation", "freshness_window"] },
] as const;

export const V10_SCRIPTED_QA_CONTRACTS: readonly V10HardeningContract[] = [
  { key: "final_qa_sampling", requirements: ["scenario_id", "fixture_id", "expected_state", "observed_state", "artifact_ref"] },
  { key: "failure_injection", requirements: ["diagnostic_id", "audit_event", "telemetry_or_evidence_key", "blocker_if_mismatch"] },
  { key: "negative_case_sampling", requirements: ["cross_org", "hidden_module", "plan_denial", "revoked_link", "unsafe_export", "private_text_redaction"] },
] as const;

export const V10_NEGATIVE_RISK_TEST_PLANS: readonly V10NegativeRiskTestPlan[] = [
  {
    category: "authorization",
    scenarioIds: ["cross_tenant_contract_export_denied", "forged_org_import_retry_denied", "hidden_assurance_module_search_non_leakage"],
    expectedFailureModes: ["not_found", "hidden_module", "private_no_store"],
    requiredProof: ["api", "release_check"],
    supportSafeDiagnosticRequired: true,
  },
  {
    category: "privacy",
    scenarioIds: ["unsafe_csv_formula_export_redacted", "revoked_external_evidence_link_denied"],
    expectedFailureModes: ["redacted_metadata", "external_link_revoked", "formula_blocked"],
    requiredProof: ["unit", "api", "release_check"],
    supportSafeDiagnosticRequired: true,
  },
  {
    category: "concurrency",
    scenarioIds: ["stale_task_expected_version_conflict", "duplicate_idempotency_payload_conflict"],
    expectedFailureModes: ["stale_version", "payload_conflict", "idempotency_in_progress"],
    requiredProof: ["unit", "api"],
    supportSafeDiagnosticRequired: true,
  },
  {
    category: "stale_data",
    scenarioIds: ["read_model_refresh_partial", "stale_command_index_recovery"],
    expectedFailureModes: ["partial", "stale", "repair_required"],
    requiredProof: ["unit", "api", "ui"],
    supportSafeDiagnosticRequired: true,
  },
  {
    category: "retries",
    scenarioIds: ["retryable_import_job", "retryable_report_export_job", "cron_wrong_secret_rejected"],
    expectedFailureModes: ["failed_retryable", "rate_limited", "unauthorized"],
    requiredProof: ["api", "release_check"],
    supportSafeDiagnosticRequired: true,
  },
  {
    category: "large_result",
    scenarioIds: ["large_work_queue_bounded", "fifty_thousand_row_export_async_handoff", "command_search_large_result_limit"],
    expectedFailureModes: ["bounded_limit", "async_handoff", "truncation_metadata"],
    requiredProof: ["unit", "ui", "e2e"],
    supportSafeDiagnosticRequired: true,
  },
] as const;

export const V10_QUALITY_SECURITY_CI_COVERAGE_GATES: readonly V10QualitySecurityCiCoverageGate[] = [
  {
    category: "unit",
    command: "npm run test -- --run src/lib/v10-*.v10.test.ts",
    artifacts: ["src/lib/server-contracts.test.ts", "src/lib/read-models.ts"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: false,
    failureModeCovered: true,
  },
  {
    category: "api",
    command: "npm run test -- --run src/app/api/**/*.test.ts",
    artifacts: ["src/app/api/export/contracts/route.test.ts", "src/app/api/report-packs/route.test.ts"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: false,
    failureModeCovered: true,
  },
  {
    category: "ui",
    command: "npm run test -- --run src/components/**/*.ui.test.tsx",
    artifacts: ["src/components/layout/command-palette.ui.test.tsx", "src/components/contracts/contract-table.ui.test.tsx"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: false,
    failureModeCovered: true,
  },
  {
    category: "e2e",
    command: "npm run test:e2e:current-product",
    artifacts: ["e2e/current-product-core-smoke.spec.ts"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: true,
    failureModeCovered: true,
  },
  {
    category: "migration",
    command: "npm run check:migration-smoke:current:strict",
    artifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "scripts/check-migration-smoke-current.mjs"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: false,
    failureModeCovered: true,
  },
  {
    category: "failure_injection",
    command: "npm run check:release-suite-current -- --fixture all",
    artifacts: ["src/lib/hardening-contracts.ts", "src/lib/objective-measurements.ts"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: true,
    failureModeCovered: true,
  },
  {
    category: "security",
    command: "npm run check:security-static:strict",
    artifacts: ["semgrep/oblixa-v10-surface.yml", "src/lib/hardening-contracts.ts"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: false,
    failureModeCovered: true,
  },
  {
    category: "privacy",
    command: "npm run check:release-privacy-scan",
    artifacts: ["src/lib/release-evidence.ts", "src/lib/objective-telemetry.ts"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: true,
    failureModeCovered: true,
  },
  {
    category: "accessibility",
    command: "npm run test:e2e:current-product -- --grep accessibility",
    artifacts: ["e2e/current-product-core-smoke.spec.ts", "src/components/ui/recoverable-state.tsx"],
    blocksCi: false,
    blocksPromotion: true,
    runtimeEvidenceRequired: true,
    failureModeCovered: true,
  },
  {
    category: "responsive",
    command: "npm run test:e2e:current-product -- --grep responsive",
    artifacts: ["e2e/current-product-core-smoke.spec.ts", "src/app/(dashboard)/work/page.tsx"],
    blocksCi: false,
    blocksPromotion: true,
    runtimeEvidenceRequired: true,
    failureModeCovered: true,
  },
  {
    category: "performance",
    command: "npm run check:release-evidence -- --metric all --lock all",
    artifacts: ["src/lib/objective-measurements.ts", "scripts/check-release-evidence.mjs"],
    blocksCi: false,
    blocksPromotion: true,
    runtimeEvidenceRequired: true,
    failureModeCovered: true,
  },
  {
    category: "release_evidence",
    command: "npm run report:runtime-evidence-plan",
    artifacts: ["src/lib/release-evidence.ts", "supabase/migrations/057_v10_runtime_contracts.sql"],
    blocksCi: true,
    blocksPromotion: true,
    runtimeEvidenceRequired: true,
    failureModeCovered: true,
  },
] as const;


export const V10_DATABASE_HARDENING_CONTRACTS: readonly V10DatabaseHardeningContract[] = [
  {
    table: "v10_mutation_idempotency",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "actor_user_id", "mutation_name", "target_type", "target_id", "idempotency_key"],
    requiredIndexes: ["idx_v10_mutation_idempotency_lookup", "idx_v10_mutation_idempotency_expiry", "idx_v10_mutation_idempotency_in_progress"],
    retentionRule: "expires_at",
    cleanupRoutine: "cleanup_expired_v10_mutation_idempotency",
    repairPath: null,
  },
  {
    table: "v10_audit_events",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "id"],
    requiredIndexes: ["idx_v10_audit_events_org_created", "idx_v10_audit_events_org_action_created", "idx_v10_audit_events_target"],
    retentionRule: "created_at",
    cleanupRoutine: null,
    repairPath: "recordV10AuditEvent",
  },
  {
    table: "v10_read_model_rows",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "model_key", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_read_model_rows_org_model", "idx_v10_read_model_rows_org_model_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_activation_state",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_activation_state_org_contract", "idx_v10_activation_state_org_state", "idx_v10_activation_state_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_work_items",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id", "type"],
    requiredIndexes: ["idx_v10_work_items_org_lens", "idx_v10_work_items_org_visibility_status", "idx_v10_work_items_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_contract_health_snapshots",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_contract_health_org_contract", "idx_v10_contract_health_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_contract_activity_events",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_contract_activity_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_field_provenance_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_field_provenance_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_renewal_posture_snapshots",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_renewal_posture_org_posture", "idx_v10_renewal_posture_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_evidence_request_statuses",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_evidence_status_org_due", "idx_v10_evidence_status_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_obligation_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_obligation_records_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_approval_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_approval_records_org_due", "idx_v10_approval_records_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_exception_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_exception_records_org_severity", "idx_v10_exception_records_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_notification_deliveries",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_notification_deliveries_org_status", "idx_v10_notification_deliveries_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_renewal_checkpoint_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_renewal_checkpoints_org_due", "idx_v10_renewal_checkpoints_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_external_evidence_submissions",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_external_evidence_org_request", "idx_v10_external_evidence_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_job_run_visibility",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_job_visibility_org_status", "idx_v10_job_visibility_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_report_run_visibility",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_report_visibility_org_status", "idx_v10_report_visibility_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_command_search_index",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_command_search_rank_terms", "idx_v10_command_search_org_visibility", "idx_v10_command_search_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_release_evidence_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "evidence_key", "release_state"],
    requiredIndexes: ["unique (organization_id, evidence_key, release_state)"],
    retentionRule: "status",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-evidence.mjs",
  },
  {
    table: "v10_fixture_manifests",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "fixture_version"],
    requiredIndexes: ["idx_v10_fixture_manifests_org_category"],
    retentionRule: "teardown_status",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-evidence.mjs",
  },
  {
    table: "v10_denominator_locks",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "metric_key", "release_state"],
    requiredIndexes: ["idx_v10_denominator_locks_org_metric"],
    retentionRule: "status",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-evidence.mjs",
  },
  {
    table: "v10_metric_runs",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "metric_key", "release_state"],
    requiredIndexes: ["idx_v10_metric_runs_org_metric_state"],
    retentionRule: "status",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-evidence.mjs",
  },
  {
    table: "v10_promotion_decisions",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "release_state"],
    requiredIndexes: ["idx_v10_promotion_decisions_org_state"],
    retentionRule: "decided_at",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-promotable.mjs",
  },
  {
    table: "v10_release_waivers",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "waiver_key"],
    requiredIndexes: ["idx_v10_release_waivers_org_status"],
    retentionRule: "status",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-evidence.mjs",
  },
  {
    table: "v10_verification_command_results",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "command", "captured_at"],
    requiredIndexes: ["idx_v10_verification_command_results_org_status"],
    retentionRule: "captured_at",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-evidence.mjs",
  },
  {
    table: "v10_external_blocker_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "blocker_key", "release_state"],
    requiredIndexes: ["idx_v10_external_blocker_records_org_state"],
    retentionRule: "status",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-evidence.mjs",
  },
  {
    table: "v10_fixture_teardown_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "teardown_key"],
    requiredIndexes: ["idx_v10_fixture_teardown_records_org_status"],
    retentionRule: "status",
    cleanupRoutine: null,
    repairPath: "scripts/check-release-suite-current.mjs",
  },
  {
    table: "v10_runtime_artifacts",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "artifact_key"],
    requiredIndexes: ["idx_v10_runtime_artifacts_org_kind", "idx_v10_runtime_artifacts_org_key_upsert"],
    retentionRule: "expires_at",
    cleanupRoutine: "cleanup_expired_v10_runtime_artifacts",
    repairPath: "replace_v10_read_model_rows",
  },
  {
    table: "v10_read_model_refresh_jobs",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "refresh_job_id"],
    requiredIndexes: ["idx_v10_refresh_jobs_org_status", "idx_v10_refresh_jobs_org_scope_drift", "idx_v10_refresh_jobs_org_source_upsert"],
    retentionRule: "completed_at",
    cleanupRoutine: null,
    repairPath: "refreshV10ReadModelsForOrganization",
  },
  {
    table: "v10_read_model_lineage",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "refresh_job_id", "model_key", "read_model_source_table", "read_model_source_id", "source_table", "source_id"],
    requiredIndexes: ["idx_v10_lineage_org_model_source"],
    retentionRule: "refresh_job_id",
    cleanupRoutine: null,
    repairPath: "refreshV10ReadModelsForOrganization",
  },
  {
    table: "v10_runtime_coverage_ledger",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "coverage_kind", "coverage_key"],
    requiredIndexes: ["idx_v10_runtime_coverage_org_kind_status", "idx_v10_runtime_coverage_org_key_upsert"],
    retentionRule: "freshness_state",
    cleanupRoutine: null,
    repairPath: "refreshV10ReadModelsForOrganization",
  },
  {
    table: "v10_advanced_assurance_linked_records",
    rlsRequired: true,
    uniqueIdentity: ["organization_id", "record_type", "record_id"],
    requiredIndexes: ["idx_v10_advanced_assurance_org_mode_status", "idx_v10_advanced_assurance_org_source_upsert"],
    retentionRule: "visibility_state_archived",
    cleanupRoutine: null,
    repairPath: "replace_v10_read_model_rows",
  },
] as const;

export const V10_ABUSE_PRIVACY_SCALE_SURFACES: readonly V10AbusePrivacyScaleSurface[] = [
  {
    surface: "home",
    abuseCases: ["cross_org_count_probe", "hidden_module_count_leak", "stale_read_model_confusion"],
    privacyLifecycle: ["deleted_contract_suppressed", "archived_contract_explained", "support_safe_diagnostics"],
    scaleBudgets: ["dashboard_count_query_budget", "large_workspace_summary_budget"],
    concurrencyCases: ["background_refresh_during_navigation", "multi_tab_count_refresh"],
    retentionCases: ["diagnostic_retention", "release_evidence_expiry"],
    cacheFocusCases: ["private_no_store", "focus_preserved_after_refetch"],
  },
  {
    surface: "work",
    abuseCases: ["forged_owner_filter", "bulk_action_payload_conflict", "hidden_assurance_work_leak"],
    privacyLifecycle: ["deleted_source_hides_work", "archived_source_no_primary_action", "safe_owner_state"],
    scaleBudgets: ["one_thousand_work_queue", "deterministic_pagination"],
    concurrencyCases: ["stale_expected_version", "duplicate_generated_work_repair", "multi_tab_completion"],
    retentionCases: ["completed_work_retention", "orphan_work_cleanup"],
    cacheFocusCases: ["active_filter_preserved", "focus_returns_to_completed_row"],
  },
  {
    surface: "contract_record",
    abuseCases: ["private_field_probe", "advanced_section_core_leak", "audit_summary_tamper_attempt"],
    privacyLifecycle: ["deleted_contract_not_found", "archived_contract_read_only", "file_artifact_revocation"],
    scaleBudgets: ["first_fold_budget", "activity_timeline_pagination"],
    concurrencyCases: ["field_review_background_refresh", "owner_assignment_race"],
    retentionCases: ["audit_retention", "artifact_expiry"],
    cacheFocusCases: ["section_disclosure_preserved", "focus_after_drawer_close"],
  },
  {
    surface: "review",
    abuseCases: ["raw_contract_text_telemetry", "confidence_payload_injection", "cross_org_field_approval"],
    privacyLifecycle: ["rejected_input_preserved_safely", "source_file_redacted", "support_safe_provenance"],
    scaleBudgets: ["review_queue_pagination", "save_and_next_latency_budget"],
    concurrencyCases: ["edit_and_approve_stale_version", "save_and_next_race"],
    retentionCases: ["field_provenance_retention", "rejected_value_retention"],
    cacheFocusCases: ["unsaved_input_preserved", "keyboard_focus_next_field"],
  },
  {
    surface: "evidence",
    abuseCases: ["revoked_link_replay", "oversized_upload", "external_scope_expansion", "malware_scan_failure"],
    privacyLifecycle: ["token_expiry", "submission_revocation", "responder_identity_redaction"],
    scaleBudgets: ["large_file_async_handoff", "reminder_batch_budget"],
    concurrencyCases: ["resubmission_after_rejection", "owner_review_race"],
    retentionCases: ["external_submission_retention", "signed_link_ttl"],
    cacheFocusCases: ["no_store_external_page", "upload_error_focus"],
  },
  {
    surface: "reports_exports",
    abuseCases: ["csv_formula_injection", "private_field_export", "artifact_url_replay", "row_count_probe"],
    privacyLifecycle: ["artifact_revocation", "signed_url_expiry", "download_audit"],
    scaleBudgets: ["fifty_thousand_row_export", "async_report_threshold"],
    concurrencyCases: ["cancel_during_generation", "retry_partial_job"],
    retentionCases: ["artifact_retention_window", "runtime_artifact_cleanup"],
    cacheFocusCases: ["download_url_no_store", "selected_rows_preserved"],
  },
  {
    surface: "settings",
    abuseCases: ["module_visibility_race", "role_downgrade_probe", "provider_config_secret_leak"],
    privacyLifecycle: ["support_admin_boundary", "public_private_env_boundary", "notification_destination_disable"],
    scaleBudgets: ["member_list_pagination", "health_diagnostic_budget"],
    concurrencyCases: ["workspace_mode_change_invalidates_recent_commands", "notification_preference_race"],
    retentionCases: ["settings_audit_retention", "diagnostic_cleanup"],
    cacheFocusCases: ["settings_form_preserved", "focus_after_toggle"],
  },
  {
    surface: "command_palette",
    abuseCases: ["hidden_record_search_probe", "private_query_telemetry", "recent_command_stale_destination"],
    privacyLifecycle: ["deleted_result_suppressed", "archived_result_explained", "rank_terms_redacted"],
    scaleBudgets: ["debounced_search_budget", "large_result_limit"],
    concurrencyCases: ["mode_change_invalidates_search", "background_index_refresh"],
    retentionCases: ["recent_command_ttl", "search_diagnostic_retention"],
    cacheFocusCases: ["input_preserved_after_zero_result", "focus_returns_to_invoker"],
  },
] as const;

export const V10_FOUNDATION_SECURITY_PRIVACY_CONTRACTS: readonly V10FoundationSecurityPrivacyContract[] = [
  {
    key: "tenant_isolation",
    enforcedBy: ["src/lib/governance.ts", "src/lib/visibility.ts", "supabase/migrations/057_v10_runtime_contracts.sql"],
    requiredOutcomes: ["not_found", "private_no_store", "support_safe_metadata"],
    forbiddenSignals: ["target_exists", "target_organization_id", "raw_contract_text", "public_cache"],
    releaseProof: "api",
  },
  {
    key: "eligibility",
    enforcedBy: ["src/lib/governance.ts", "src/lib/route-api-catalog.ts", "src/lib/visibility.ts"],
    requiredOutcomes: ["forbidden", "plan_required", "mode_required", "hidden_module"],
    forbiddenSignals: ["hidden_record_details", "assurance_payload_in_core", "private_destination_url"],
    releaseProof: "unit",
  },
  {
    key: "audit_metadata",
    enforcedBy: ["src/lib/server-contracts.ts", "src/lib/status-action-vocabulary.ts"],
    requiredOutcomes: ["safe_metadata", "diagnostic_id", "before_after_hash"],
    forbiddenSignals: ["private_note", "responder_email", "signed_link_token"],
    releaseProof: "unit",
  },
  {
    key: "cache_headers",
    enforcedBy: ["src/lib/mutation-envelope.ts", "src/app/api/cron/v10/read-model-refresh/route.ts"],
    requiredOutcomes: ["private_no_store", "no_idempotent_cache", "no_artifact_cache"],
    forbiddenSignals: ["public_cache", "shared_cache", "signed_url_cache"],
    releaseProof: "api",
  },
  {
    key: "support_diagnostics",
    enforcedBy: ["src/lib/operational-contracts.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    requiredOutcomes: ["diagnostic_id", "recovery_destination", "customer_safe_copy"],
    forbiddenSignals: ["provider_payload", "customer_payload", "secret"],
    releaseProof: "release_check",
  },
  {
    key: "external_artifacts",
    enforcedBy: ["src/lib/report-export.ts", "src/lib/evidence-collaboration.ts"],
    requiredOutcomes: ["token_hash_only", "retention_expiry", "revocation_checked"],
    forbiddenSignals: ["signed_url", "file_content", "raw_export_cell"],
    releaseProof: "api",
  },
] as const;

export const V10_SERVICE_ROLE_BOUNDARY_CONTRACTS: readonly V10ServiceRoleBoundaryContract[] = [
  {
    artifact: "src/lib/read-model-refresh.ts",
    operation: "write",
    tables: ["v10_read_model_rows", "v10_work_items", "v10_command_search_index"],
    organizationPredicate: "organization_id",
    serviceRoleJustification: "service role rebuilds derived rows while preserving org-scoped source filters",
    cachePolicy: "not_applicable",
    auditRequired: true,
    supportSafeDiagnostics: true,
  },
  {
    artifact: "src/app/api/export/contracts/route.ts",
    operation: "write",
    tables: ["contracts", "contract_export_jobs", "v10_runtime_artifacts"],
    organizationPredicate: "organization_id",
    serviceRoleJustification: "service role reads org-scoped contract rows and writes export job visibility",
    cachePolicy: "private_no_store",
    auditRequired: true,
    supportSafeDiagnostics: true,
  },
  {
    artifact: "src/app/api/cron/v10/idempotency-cleanup/route.ts",
    operation: "rpc",
    tables: ["v10_mutation_idempotency"],
    organizationPredicate: null,
    serviceRoleJustification: "cron cleanup only removes expired idempotency rows by retention cutoff",
    cachePolicy: "private_no_store",
    auditRequired: false,
    supportSafeDiagnostics: true,
  },
] as const;

export const V10_PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS: readonly V10ProviderIntegrationBoundaryContract[] = [
  {
    provider: "supabase",
    owner: "engineering",
    readinessArtifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "scripts/check-migration-smoke-current.mjs"],
    degradedState: "migration_smoke_failed",
    privacyBoundary: ["rls", "service_role_predicates", "storage_signed_url_redaction"],
    releaseBlockerKey: "provider:supabase",
    fallbackBehavior: "hold promotion and route to settings health",
  },
  {
    provider: "vercel",
    owner: "engineering",
    readinessArtifacts: ["vercel.json", "scripts/check-vercel-cron-alignment.mjs"],
    degradedState: "cron_alignment_failed",
    privacyBoundary: ["private_no_store", "log_redaction", "env_secret_boundary"],
    releaseBlockerKey: "provider:vercel",
    fallbackBehavior: "disable runtime promotion until cron alignment passes",
  },
  {
    provider: "resend",
    owner: "operations",
    readinessArtifacts: ["src/lib/evidence-collaboration.ts"],
    degradedState: "notification_provider_outage",
    privacyBoundary: ["recipient_state_only", "no_email_in_diagnostics", "suppression_reason_only"],
    releaseBlockerKey: "provider:resend",
    fallbackBehavior: "queue retryable notifications and show provider health",
  },
  {
    provider: "openai",
    owner: "engineering",
    readinessArtifacts: ["src/lib/hardening-contracts.ts"],
    degradedState: "extraction_provider_unavailable",
    privacyBoundary: ["no_prompt_in_logs", "raw_text_redaction", "diagnostic_id_only"],
    releaseBlockerKey: "provider:openai",
    fallbackBehavior: "surface extraction retry and preserve manual review path",
  },
  {
    provider: "stripe",
    owner: "revenue",
    readinessArtifacts: ["src/lib/governance.ts"],
    degradedState: "billing_entitlement_unknown",
    privacyBoundary: ["plan_state_only", "no_payment_payloads", "webhook_signature_required"],
    releaseBlockerKey: "provider:stripe",
    fallbackBehavior: "fail closed to current entitlement and route to billing",
  },
  {
    provider: "playwright",
    owner: "qa",
    readinessArtifacts: ["e2e/current-product-core-smoke.spec.ts", "package.json"],
    degradedState: "browser_harness_unavailable",
    privacyBoundary: ["auth_state_isolated", "fixture_cleanup", "artifact_retention"],
    releaseBlockerKey: "provider:playwright",
    fallbackBehavior: "block complete promotion until v10 browser evidence is captured",
  },
  {
    provider: "vitest",
    owner: "engineering",
    readinessArtifacts: ["vitest.config.ts", "vitest.ui.config.ts"],
    degradedState: "unit_harness_unavailable",
    privacyBoundary: ["fixture_only", "no_private_snapshots", "test_env_redaction"],
    releaseBlockerKey: "provider:vitest",
    fallbackBehavior: "block CI gate until v10 suite passes",
  },
  {
    provider: "semgrep",
    owner: "security",
    readinessArtifacts: ["semgrep/oblixa-v10-surface.yml", "scripts/check-semgrep-rulepack-integrity.mjs"],
    degradedState: "static_security_gate_unavailable",
    privacyBoundary: ["raw_contract_text_rule", "signed_url_rule", "telemetry_privacy_rule"],
    releaseBlockerKey: "provider:semgrep",
    fallbackBehavior: "block release security gate until rulepack passes",
  },
] as const;

export const V10_HARDENING_CONTRACTS = [
  ...V10_FOUNDATION_SECURITY_PRIVACY_CONTRACTS.map((contract) => ({
    key: `foundation:${contract.key}`,
    requirements: [...contract.requiredOutcomes, ...contract.forbiddenSignals.map((signal) => `forbid:${signal}`)],
  })),
  ...V10_SERVICE_ROLE_BOUNDARY_CONTRACTS.map((contract) => ({
    key: `service_role:${contract.artifact}`,
    requirements: [
      contract.operation,
      contract.organizationPredicate ? "org_predicate" : "retention_cutoff_only",
      contract.cachePolicy,
      contract.auditRequired ? "audit_required" : "audit_not_required",
      contract.supportSafeDiagnostics ? "support_safe_diagnostics" : "support_diagnostics_missing",
    ],
  })),
  ...V10_PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS.map((contract) => ({
    key: `provider:${contract.provider}`,
    requirements: [
      "readiness_artifact",
      contract.degradedState,
      ...contract.privacyBoundary,
      contract.releaseBlockerKey,
      "fallback_behavior",
    ],
  })),
  ...V10_EVIDENCE_DEPENDENCY_GRAPH,
  ...V10_REQUIREMENT_ID_CONTRACTS,
  ...V10_INVARIANT_GENERATION_CONTRACTS,
  ...V10_ADVERSARIAL_TEST_CONTRACTS,
  ...V10_PERSONA_WORKSPACE_COVERAGE,
  ...V10_RECONCILIATION_JOB_CONTRACTS,
  ...V10_API_SNAPSHOT_CONTRACTS,
  ...V10_NOTIFICATION_DEDUPE_CONTRACTS,
  ...V10_ERROR_BUDGET_AUDIT_CONTRACTS,
  ...V10_DEPENDENCY_SUPPLY_CHAIN_CONTRACTS,
  ...V10_DEPRECATION_CLEANUP_CONTRACTS,
  ...V10_SUPPORT_DOC_BOUNDARY_CONTRACTS,
  ...V10_SCRIPTED_QA_CONTRACTS,
  ...V10_NEGATIVE_RISK_TEST_PLANS.map((plan) => ({
    key: `negative:${plan.category}`,
    requirements: [...plan.expectedFailureModes, ...plan.requiredProof],
  })),
  ...V10_DATABASE_HARDENING_CONTRACTS.map((contract) => ({
    key: `db:${contract.table}`,
    requirements: [
      contract.rlsRequired ? "rls" : "rls_not_required",
      "unique_identity",
      "indexes",
      contract.retentionRule ? "retention" : "retention_not_applicable",
      contract.cleanupRoutine ? "cleanup" : "cleanup_not_applicable",
      contract.repairPath ? "repair" : "repair_not_applicable",
    ],
  })),
] as const;

const FORBIDDEN_COPY_TERMS = /\b(raw contract text|customer name|customer names|email address|token|secret|private url|signed url|filename|provider error)\b/i;
const SENSITIVE_DIAGNOSTIC_VALUE_RE =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/|token|secret|signed_url|-----BEGIN|\.(pdf|docx?|xlsx?|csv)\b/i;

export function isV10CopyPrivacySafe(copy: string): boolean {
  return !FORBIDDEN_COPY_TERMS.test(copy);
}

export function sanitizeV10DiagnosticMetadata(
  metadata: Record<string, string | number | boolean | null>
): {
  safe: Record<string, string | number | boolean | null>;
  droppedKeys: string[];
} {
  const unsafe = /raw|text|email|token|secret|private.?url|customer.?name|file/i;
  const safe: Record<string, string | number | boolean | null> = {};
  const droppedKeys: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (unsafe.test(key)) {
      droppedKeys.push(key);
    } else if (typeof value === "string" && SENSITIVE_DIAGNOSTIC_VALUE_RE.test(value)) {
      safe[key] = "redacted";
    } else {
      safe[key] = value;
    }
  }
  return { safe, droppedKeys };
}

export function sanitizeV10InternalHref(href: string, fallback = "/work"): string {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (/[\r\n]/.test(trimmed)) return fallback;
  if (/token=|signature=|signed|secret|password|private[_-]?url/i.test(trimmed)) return fallback;
  return trimmed;
}

export function validateV10RuntimeArtifactPrivacy(input: V10RuntimeArtifactPrivacyInput, now = new Date()): string[] {
  const failures: string[] = [];
  if (!input.artifactKind) failures.push("artifact_kind_required");
  if (input.classification === "prohibited") failures.push("prohibited_artifact_must_not_be_member_visible");
  if (input.classification === "customer_private" && input.accessScope === "organization") {
    failures.push("customer_private_artifact_requires_narrow_scope");
  }
  if (input.href && /token=|signature=|signed|https?:\/\//i.test(input.href)) failures.push("artifact_href_must_not_expose_signed_url");
  if (input.expiresAt && new Date(input.expiresAt) < now && input.visibilityState === "visible") {
    failures.push("expired_artifact_must_be_archived_or_revoked");
  }
  if (input.revokedAt && input.visibilityState === "visible") failures.push("revoked_artifact_must_not_be_visible");
  if (!input.checksum && input.artifactKind !== "support_diagnostic" && input.artifactKind !== "signed_link") {
    failures.push("artifact_checksum_required");
  }
  return failures;
}

export function validateV10TenantIsolationDecision(input: V10TenantIsolationDecision): string[] {
  const failures: string[] = [];
  const sameOrg =
    Boolean(input.actorOrganizationId) &&
    Boolean(input.targetOrganizationId) &&
    input.actorOrganizationId === input.targetOrganizationId;
  const targetUnknown = input.targetExists === null || input.targetOrganizationId === null;
  if (!sameOrg || targetUnknown) {
    if (input.responseStatus !== 404) failures.push("tenant_denial_must_not_confirm_existence");
    if (input.outcome !== "not_found") failures.push("tenant_denial_outcome_must_be_not_found");
    if (!input.diagnosticId?.startsWith("v10_")) failures.push("tenant_denial_v10_diagnostic_required");
  }
  if (input.cacheControl !== "private, no-store") failures.push("tenant_denial_private_no_store_required");
  const metadata = sanitizeV10DiagnosticMetadata(input.supportSafeMetadata);
  if (metadata.droppedKeys.length > 0 || Object.values(metadata.safe).includes("redacted")) {
    failures.push("tenant_denial_support_metadata_must_be_safe");
  }
  if ("target_exists" in input.supportSafeMetadata || "target_organization_id" in input.supportSafeMetadata) {
    failures.push("tenant_denial_metadata_must_not_confirm_target");
  }
  return failures;
}

export function validateV10FoundationSecurityPrivacyContracts(
  contracts: readonly V10FoundationSecurityPrivacyContract[] = V10_FOUNDATION_SECURITY_PRIVACY_CONTRACTS
): string[] {
  const failures: string[] = [];
  const requiredKeys: readonly V10FoundationSecurityPrivacyContract["key"][] = [
    "tenant_isolation",
    "eligibility",
    "audit_metadata",
    "cache_headers",
    "support_diagnostics",
    "external_artifacts",
  ];
  for (const key of requiredKeys) {
    if (!contracts.some((contract) => contract.key === key)) failures.push(`foundation_security_missing:${key}`);
  }
  for (const contract of contracts) {
    if (contract.enforcedBy.length === 0) failures.push(`${contract.key}:enforcement_artifact_required`);
    if (contract.requiredOutcomes.length === 0) failures.push(`${contract.key}:required_outcome_required`);
    if (contract.forbiddenSignals.length === 0) failures.push(`${contract.key}:forbidden_signal_required`);
    if (contract.requiredOutcomes.includes("private_no_store") && !contract.forbiddenSignals.some((signal) => /cache|signed_url/i.test(signal))) {
      failures.push(`${contract.key}:cache_leak_signal_required`);
    }
    if (contract.key === "tenant_isolation" && !contract.requiredOutcomes.includes("not_found")) {
      failures.push("tenant_isolation:must_hide_existence");
    }
    if (contract.key === "audit_metadata" && !contract.forbiddenSignals.some((signal) => /email|note|token/i.test(signal))) {
      failures.push("audit_metadata:sensitive_metadata_signal_required");
    }
    if (contract.releaseProof === "release_check" && !contract.enforcedBy.some((artifact) => /release|operational|health/.test(artifact))) {
      failures.push(`${contract.key}:release_check_artifact_required`);
    }
  }
  if (new Set(contracts.map((contract) => contract.key)).size !== contracts.length) failures.push("foundation_security_duplicate");
  return failures;
}

export function validateV10ServiceRoleBoundaryContracts(
  contracts: readonly V10ServiceRoleBoundaryContract[] = V10_SERVICE_ROLE_BOUNDARY_CONTRACTS
): string[] {
  const failures: string[] = [];
  for (const contract of contracts) {
    if (!contract.artifact.trim()) failures.push("service_role_artifact_required");
    if (contract.tables.length === 0) failures.push(`${contract.artifact}:table_required`);
    if (!contract.serviceRoleJustification.trim()) failures.push(`${contract.artifact}:justification_required`);
    if (contract.operation !== "cron" && contract.tables.some((table) => !table.startsWith("v10_")) && !contract.organizationPredicate) {
      failures.push(`${contract.artifact}:organization_predicate_required`);
    }
    if (contract.cachePolicy !== "private_no_store" && contract.artifact.includes("/api/")) {
      failures.push(`${contract.artifact}:private_no_store_required`);
    }
    if (contract.auditRequired && !/audit|derived rows|visibility/i.test(contract.serviceRoleJustification)) {
      failures.push(`${contract.artifact}:audit_justification_required`);
    }
    if (!contract.supportSafeDiagnostics) failures.push(`${contract.artifact}:support_safe_diagnostics_required`);
  }
  if (new Set(contracts.map((contract) => contract.artifact)).size !== contracts.length) {
    failures.push("service_role_boundary_duplicate");
  }
  return failures;
}

export function validateV10ProviderIntegrationBoundaryContracts(
  contracts: readonly V10ProviderIntegrationBoundaryContract[] = V10_PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS
): string[] {
  const failures: string[] = [];
  for (const contract of contracts) {
    if (!contract.owner.trim()) failures.push(`${contract.provider}:owner_required`);
    if (contract.readinessArtifacts.length === 0) failures.push(`${contract.provider}:readiness_artifact_required`);
    if (!contract.degradedState.trim()) failures.push(`${contract.provider}:degraded_state_required`);
    if (contract.privacyBoundary.length === 0) failures.push(`${contract.provider}:privacy_boundary_required`);
    if (!contract.releaseBlockerKey.startsWith("provider:")) failures.push(`${contract.provider}:release_blocker_key_required`);
    if (!contract.fallbackBehavior.trim()) failures.push(`${contract.provider}:fallback_behavior_required`);
  }
  for (const provider of ["supabase", "vercel", "resend", "openai", "stripe", "playwright", "vitest", "semgrep"] as const) {
    if (!contracts.some((contract) => contract.provider === provider)) failures.push(`provider_boundary_missing:${provider}`);
  }
  if (new Set(contracts.map((contract) => contract.provider)).size !== contracts.length) {
    failures.push("provider_boundary_duplicate");
  }
  return failures;
}

export function validateV10SupplyChainScripts(scripts: Record<string, string | undefined>): string[] {
  const legacyCurrentProductE2eScript = `test:e2e:v${10}`;
  const requiredScripts = [
    "check:release-suite-current",
    "check:release-evidence",
    "check:release-privacy-scan",
    "typecheck",
    "lint",
    "test:e2e:current-product",
    legacyCurrentProductE2eScript,
  ];
  const failures: string[] = [];
  for (const script of requiredScripts) {
    if (!scripts[script]) failures.push(`missing_script:${script}`);
  }
  if (!scripts.sbom) failures.push("missing_script:sbom");
  if (!scripts["audit:moderate"]) failures.push("missing_script:audit:moderate");
  return failures;
}

export function validateV10DeprecationCleanupDecision(input: {
  artifact: string;
  supersededBy?: string | null;
  retirementReason?: string | null;
  testsPreserved?: boolean;
  releaseEvidenceKey?: string | null;
  owner?: string | null;
}): string[] {
  const failures: string[] = [];
  if (!input.artifact) failures.push("artifact_required");
  if (!input.supersededBy) failures.push("supersession_target_required");
  if (!input.retirementReason) failures.push("retirement_reason_required");
  if (!input.testsPreserved) failures.push("tests_preservation_required");
  if (!input.releaseEvidenceKey) failures.push("release_evidence_key_required");
  if (!input.owner) failures.push("owner_required");
  return failures;
}

export function validateV10LegacyProofCutoverContracts(
  contracts: readonly V10LegacyProofCutoverContract[] = V10_LEGACY_PROOF_CUTOVER_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.legacyArtifact)) failures.push(`legacy_cutover_duplicate:${contract.legacyArtifact}`);
    seen.add(contract.legacyArtifact);
    if (!contract.legacyArtifact.trim()) failures.push("legacy_artifact_required");
    if (!contract.replacementEvidenceKey.startsWith("v10-")) failures.push(`${contract.legacyArtifact}:v10_evidence_key_required`);
    if (!contract.replacementCommand.startsWith("npm run ")) failures.push(`${contract.legacyArtifact}:replacement_command_required`);
    if (!contract.allowedOnlyAfterRuntimeProof) failures.push(`${contract.legacyArtifact}:runtime_proof_gate_required`);
    if (!contract.testsPreserved) failures.push(`${contract.legacyArtifact}:tests_preservation_required`);
    if (!contract.rollbackArtifact.trim()) failures.push(`${contract.legacyArtifact}:rollback_artifact_required`);
    if (contract.cutoverAction === "retire" && contract.proofPath !== "v9_legacy") {
      failures.push(`${contract.legacyArtifact}:retire_requires_legacy_path`);
    }
  }
  for (const proofPath of ["descriptor_fixture", "static_contract", "v9_legacy", "environment_gate"] as const) {
    if (!contracts.some((contract) => contract.proofPath === proofPath)) failures.push(`legacy_cutover_missing:${proofPath}`);
  }
  return failures;
}

export function validateV10SupportDocBoundary(input: {
  docPath: string;
  referencesShippedBehavior?: boolean;
  referencesDiagnostics?: boolean;
  referencesRecoveryPath?: boolean;
  referencesReleaseEvidence?: boolean;
  claimsCompletionProof?: boolean;
  containsPrivatePayload?: boolean;
}): string[] {
  const failures: string[] = [];
  if (!input.docPath) failures.push("doc_path_required");
  if (!input.referencesShippedBehavior) failures.push("shipped_behavior_reference_required");
  if (!input.referencesDiagnostics) failures.push("diagnostic_reference_required");
  if (!input.referencesRecoveryPath) failures.push("recovery_path_required");
  if (!input.referencesReleaseEvidence) failures.push("release_evidence_reference_required");
  if (input.claimsCompletionProof) failures.push("docs_cannot_claim_completion_proof");
  if (input.containsPrivatePayload) failures.push("private_payload_forbidden");
  return failures;
}

export function validateV10ScriptedQaScenario(scenario: V10ScriptedQaScenario): string[] {
  const failures: string[] = [];
  if (!scenario.scenario_id) failures.push("scenario_id_required");
  if (!scenario.fixture_id) failures.push("fixture_id_required");
  if (!scenario.route_or_action) failures.push("route_or_action_required");
  if (!scenario.expected_state) failures.push("expected_state_required");
  if (!scenario.observed_state) failures.push("observed_state_required");
  if (!scenario.artifact_ref) failures.push("artifact_ref_required");
  if (!scenario.telemetry_or_evidence_key) failures.push("telemetry_or_evidence_key_required");
  if (/failed|retry|denied|blocked|stale|revoked|unsafe|partial|truncated/i.test(scenario.expected_state) && !scenario.diagnostic_id) {
    failures.push("diagnostic_id_required_for_failure_state");
  }
  if (scenario.state_changing && !scenario.audit_event_id) failures.push("audit_event_required_for_state_change");
  if (scenario.observed_state && scenario.expected_state !== scenario.observed_state && !scenario.blocker) {
    failures.push("blocker_required_for_state_mismatch");
  }
  return failures;
}

export function validateV10AdversarialRouteActionScenario(scenario: V10AdversarialRouteActionScenario): string[] {
  const failures: string[] = [];
  if (!scenario.scenario_id) failures.push("scenario_id_required");
  if (!scenario.route_or_action) failures.push("route_or_action_required");
  if (!scenario.diagnostic_id.startsWith("v10_")) failures.push("v10_diagnostic_required");
  if (scenario.expected_status < 400) failures.push("negative_case_must_not_return_success");
  if (scenario.idempotency_required && scenario.adversary !== "idempotency_replay" && scenario.expected_status === 409 && scenario.expected_outcome !== "stale_version") {
    failures.push("conflict_must_distinguish_stale_or_replay");
  }
  if (scenario.adversary === "cron_auth" && (scenario.audit_required || scenario.idempotency_required)) {
    failures.push("cron_auth_denial_must_fail_before_mutation");
  }
  if (scenario.adversary === "revoked_link" && scenario.expected_status !== 410) failures.push("revoked_link_must_return_gone");
  if ((scenario.adversary === "cross_tenant" || scenario.adversary === "forged_org") && scenario.expected_status !== 404) {
    failures.push("tenant_isolation_must_not_confirm_existence");
  }
  return failures;
}

export function validateV10AdversarialRouteActionScenarioSet(
  scenarios: readonly V10AdversarialRouteActionScenario[] = V10_ADVERSARIAL_ROUTE_ACTION_SCENARIOS
): string[] {
  const failures = scenarios.flatMap((scenario) =>
    validateV10AdversarialRouteActionScenario(scenario).map((failure) => `${scenario.scenario_id || "unknown"}:${failure}`)
  );
  for (const adversary of [
    "cross_tenant",
    "forged_org",
    "stale_version",
    "idempotency_replay",
    "hidden_module",
    "plan_denial",
    "revoked_link",
    "unsafe_export",
    "malformed_payload",
    "cron_auth",
  ] as const) {
    if (!scenarios.some((scenario) => scenario.adversary === adversary)) failures.push(`missing_adversary:${adversary}`);
  }
  return failures;
}

export function validateV10AbusePrivacyScaleSurfaces(
  surfaces: readonly V10AbusePrivacyScaleSurface[] = V10_ABUSE_PRIVACY_SCALE_SURFACES
): string[] {
  const failures: string[] = [];
  const requiredSurfaces = ["home", "work", "contract_record", "review", "evidence", "reports_exports", "settings", "command_palette"];
  for (const surface of requiredSurfaces) {
    if (!surfaces.some((entry) => entry.surface === surface)) failures.push(`surface_missing:${surface}`);
  }
  for (const surface of surfaces) {
    if (surface.abuseCases.length === 0) failures.push(`${surface.surface}:abuse_case_required`);
    if (surface.privacyLifecycle.length === 0) failures.push(`${surface.surface}:privacy_lifecycle_required`);
    if (surface.scaleBudgets.length === 0) failures.push(`${surface.surface}:scale_budget_required`);
    if (surface.concurrencyCases.length === 0) failures.push(`${surface.surface}:concurrency_case_required`);
    if (surface.retentionCases.length === 0) failures.push(`${surface.surface}:retention_case_required`);
    if (surface.cacheFocusCases.length === 0) failures.push(`${surface.surface}:cache_focus_case_required`);
    if (!surface.cacheFocusCases.some((item) => /focus|preserved|no_store/i.test(item))) {
      failures.push(`${surface.surface}:focus_or_cache_preservation_required`);
    }
    if (!surface.privacyLifecycle.some((item) => /deleted|archived|revocation|expiry|redaction|boundary|safe/i.test(item))) {
      failures.push(`${surface.surface}:privacy_lifecycle_state_required`);
    }
  }
  if (new Set(surfaces.map((surface) => surface.surface)).size !== surfaces.length) failures.push("surface_duplicate");
  return failures;
}

export function validateV10DatabaseHardeningContracts(
  contracts: readonly V10DatabaseHardeningContract[] = V10_DATABASE_HARDENING_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.table)) failures.push(`duplicate_db_hardening:${contract.table}`);
    seen.add(contract.table);
    if (!contract.table.startsWith("v10_")) failures.push(`${contract.table}:v10_table_required`);
    if (!contract.rlsRequired) failures.push(`${contract.table}:rls_required`);
    if (!contract.uniqueIdentity.includes("organization_id")) failures.push(`${contract.table}:org_scoped_unique_identity_required`);
    if (contract.uniqueIdentity.length < 2) failures.push(`${contract.table}:unique_identity_incomplete`);
    if (contract.requiredIndexes.length === 0) failures.push(`${contract.table}:index_required`);
    if (contract.retentionRule === "expires_at" && !contract.cleanupRoutine) failures.push(`${contract.table}:expiry_cleanup_required`);
    if (!contract.cleanupRoutine && !contract.repairPath) failures.push(`${contract.table}:cleanup_or_repair_required`);
  }
  for (const required of ["v10_mutation_idempotency", "v10_read_model_rows", "v10_work_items", "v10_runtime_artifacts"]) {
    if (!seen.has(required)) failures.push(`missing_db_hardening:${required}`);
  }
  return failures;
}

export function validateV10NegativeRiskTestPlans(
  plans: readonly V10NegativeRiskTestPlan[] = V10_NEGATIVE_RISK_TEST_PLANS
): string[] {
  const failures: string[] = [];
  const requiredCategories: readonly V10NegativeRiskCategory[] = ["authorization", "privacy", "concurrency", "stale_data", "retries", "large_result"];
  const seen = new Set<V10NegativeRiskCategory>();
  for (const plan of plans) {
    if (seen.has(plan.category)) failures.push(`negative_risk_duplicate:${plan.category}`);
    seen.add(plan.category);
    if (plan.scenarioIds.length === 0) failures.push(`${plan.category}:scenario_required`);
    if (plan.expectedFailureModes.length === 0) failures.push(`${plan.category}:failure_mode_required`);
    if (plan.requiredProof.length === 0) failures.push(`${plan.category}:proof_required`);
    if (!plan.supportSafeDiagnosticRequired) failures.push(`${plan.category}:support_safe_diagnostic_required`);
    if (plan.category === "authorization" && !plan.expectedFailureModes.includes("not_found")) {
      failures.push("authorization:must_hide_existence");
    }
    if (plan.category === "large_result" && !plan.expectedFailureModes.some((mode) => /bounded|async|truncation/.test(mode))) {
      failures.push("large_result:bounded_or_async_required");
    }
  }
  for (const category of requiredCategories) {
    if (!seen.has(category)) failures.push(`negative_risk_missing:${category}`);
  }
  return failures;
}

export function validateV10QualitySecurityCiCoverageGates(
  gates: readonly V10QualitySecurityCiCoverageGate[] = V10_QUALITY_SECURITY_CI_COVERAGE_GATES
): string[] {
  const failures: string[] = [];
  const requiredCategories: readonly V10QualitySecurityCiCoverageCategory[] = [
    "unit",
    "api",
    "ui",
    "e2e",
    "migration",
    "failure_injection",
    "security",
    "privacy",
    "accessibility",
    "responsive",
    "performance",
    "release_evidence",
  ];
  const seen = new Set<V10QualitySecurityCiCoverageCategory>();
  for (const gate of gates) {
    if (seen.has(gate.category)) failures.push(`quality_gate_duplicate:${gate.category}`);
    seen.add(gate.category);
    if (!gate.command.startsWith("npm run ")) failures.push(`${gate.category}:npm_command_required`);
    if (gate.artifacts.length === 0) failures.push(`${gate.category}:artifact_required`);
    if (!gate.blocksPromotion) failures.push(`${gate.category}:promotion_block_required`);
    if (!gate.failureModeCovered) failures.push(`${gate.category}:failure_mode_required`);
    if (
      (gate.category === "e2e" ||
        gate.category === "privacy" ||
        gate.category === "performance" ||
        gate.category === "release_evidence") &&
      !gate.runtimeEvidenceRequired
    ) {
      failures.push(`${gate.category}:runtime_evidence_required`);
    }
    if (
      (gate.category === "unit" ||
        gate.category === "api" ||
        gate.category === "ui" ||
        gate.category === "migration" ||
        gate.category === "security") &&
      !gate.blocksCi
    ) {
      failures.push(`${gate.category}:ci_block_required`);
    }
  }
  for (const category of requiredCategories) {
    if (!seen.has(category)) failures.push(`quality_gate_missing:${category}`);
  }
  return failures;
}

export function getV10StrictnessMode(mode: V10StrictnessMode) {
  return V10_STRICTNESS_MODES[mode];
}

export function validateV10StrictnessModeGates(
  gates: readonly V10StrictnessModeGate[] = V10_STRICTNESS_MODE_GATES
): string[] {
  const failures: string[] = [];
  const seen = new Set<V10StrictnessMode>();
  for (const gate of gates) {
    if (seen.has(gate.mode)) failures.push(`strictness_duplicate:${gate.mode}`);
    seen.add(gate.mode);
    const mode = getV10StrictnessMode(gate.mode);
    if (gate.requiredCommands.length === 0) failures.push(`${gate.mode}:command_required`);
    if (mode.requireLocalAutomation && !gate.requiredEvidence.includes("local_automation") && gate.mode !== "post_ga") {
      failures.push(`${gate.mode}:local_automation_required`);
    }
    if (mode.requireReleaseEvidence && !gate.requiredEvidence.includes("release_evidence")) {
      failures.push(`${gate.mode}:release_evidence_required`);
    }
    if (mode.requireExternalDashboard && !gate.requiredEvidence.includes("external_dashboard")) {
      failures.push(`${gate.mode}:external_dashboard_required`);
    }
    if ((gate.mode === "release_candidate" || gate.mode === "GA" || gate.mode === "complete" || gate.mode === "post_ga") && gate.failurePolicy !== "hold_release") {
      failures.push(`${gate.mode}:hold_release_policy_required`);
    }
    if (gate.mode === "ci" && gate.failurePolicy !== "fail_ci") failures.push("ci:fail_ci_policy_required");
  }
  for (const mode of Object.keys(V10_STRICTNESS_MODES) as V10StrictnessMode[]) {
    if (!seen.has(mode)) failures.push(`strictness_missing:${mode}`);
  }
  return failures;
}

export function v10HardeningContractHasRequirement(key: string, requirement: string): boolean {
  return V10_HARDENING_CONTRACTS.some((contract) => contract.key === key && contract.requirements.includes(requirement));
}

export function getV10EvidenceDependencyOrder(): readonly string[] {
  return V10_EVIDENCE_DEPENDENCY_GRAPH.map((contract) => contract.key);
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { getV10EvidenceDependencyOrder as getEvidenceDependencyOrder };
export { getV10StrictnessMode as getStrictnessMode };
export { isV10CopyPrivacySafe as isCopyPrivacySafe };
export { sanitizeV10DiagnosticMetadata as sanitizeDiagnosticMetadata };
export { sanitizeV10InternalHref as sanitizeInternalHref };
export { V10_ABUSE_PRIVACY_SCALE_SURFACES as ABUSE_PRIVACY_SCALE_SURFACES };
export { V10_ADVERSARIAL_ROUTE_ACTION_SCENARIOS as ADVERSARIAL_ROUTE_ACTION_SCENARIOS };
export { V10_ADVERSARIAL_TEST_CONTRACTS as ADVERSARIAL_TEST_CONTRACTS };
export { V10_API_SNAPSHOT_CONTRACTS as API_SNAPSHOT_CONTRACTS };
export { V10_DATABASE_HARDENING_CONTRACTS as DATABASE_HARDENING_CONTRACTS };
export { V10_DEPENDENCY_SUPPLY_CHAIN_CONTRACTS as DEPENDENCY_SUPPLY_CHAIN_CONTRACTS };
export { V10_DEPRECATION_CLEANUP_CONTRACTS as DEPRECATION_CLEANUP_CONTRACTS };
export { V10_ERROR_BUDGET_AUDIT_CONTRACTS as ERROR_BUDGET_AUDIT_CONTRACTS };
export { V10_EVIDENCE_DEPENDENCY_GRAPH as EVIDENCE_DEPENDENCY_GRAPH };
export { V10_FOUNDATION_SECURITY_PRIVACY_CONTRACTS as FOUNDATION_SECURITY_PRIVACY_CONTRACTS };
export { V10_HARDENING_CONTRACTS as HARDENING_CONTRACTS };
export { V10_INVARIANT_GENERATION_CONTRACTS as INVARIANT_GENERATION_CONTRACTS };
export { V10_LEGACY_PROOF_CUTOVER_CONTRACTS as LEGACY_PROOF_CUTOVER_CONTRACTS };
export { V10_NEGATIVE_RISK_TEST_PLANS as NEGATIVE_RISK_TEST_PLANS };
export { V10_NOTIFICATION_DEDUPE_CONTRACTS as NOTIFICATION_DEDUPE_CONTRACTS };
export { V10_PERSONA_WORKSPACE_COVERAGE as PERSONA_WORKSPACE_COVERAGE };
export { V10_PRIVACY_SAFE_COPY_CATALOG as PRIVACY_SAFE_COPY_CATALOG };
export { V10_PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS as PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS };
export { V10_QUALITY_SECURITY_CI_COVERAGE_GATES as QUALITY_SECURITY_CI_COVERAGE_GATES };
export { V10_RECONCILIATION_JOB_CONTRACTS as RECONCILIATION_JOB_CONTRACTS };
export { V10_REQUIREMENT_ID_CONTRACTS as REQUIREMENT_ID_CONTRACTS };
export { V10_SCRIPTED_QA_CONTRACTS as SCRIPTED_QA_CONTRACTS };
export { V10_SERVICE_ROLE_BOUNDARY_CONTRACTS as SERVICE_ROLE_BOUNDARY_CONTRACTS };
export { V10_STRICTNESS_MODE_GATES as STRICTNESS_MODE_GATES };
export { V10_STRICTNESS_MODES as STRICTNESS_MODES };
export { V10_SUPPORT_DOC_BOUNDARY_CONTRACTS as SUPPORT_DOC_BOUNDARY_CONTRACTS };
export { v10HardeningContractHasRequirement as hardeningContractHasRequirement };
export { validateV10AbusePrivacyScaleSurfaces as validateAbusePrivacyScaleSurfaces };
export { validateV10AdversarialRouteActionScenario as validateAdversarialRouteActionScenario };
export { validateV10AdversarialRouteActionScenarioSet as validateAdversarialRouteActionScenarioSet };
export { validateV10DatabaseHardeningContracts as validateDatabaseHardeningContracts };
export { validateV10DeprecationCleanupDecision as validateDeprecationCleanupDecision };
export { validateV10FoundationSecurityPrivacyContracts as validateFoundationSecurityPrivacyContracts };
export { validateV10LegacyProofCutoverContracts as validateLegacyProofCutoverContracts };
export { validateV10NegativeRiskTestPlans as validateNegativeRiskTestPlans };
export { validateV10ProviderIntegrationBoundaryContracts as validateProviderIntegrationBoundaryContracts };
export { validateV10QualitySecurityCiCoverageGates as validateQualitySecurityCiCoverageGates };
export { validateV10RuntimeArtifactPrivacy as validateRuntimeArtifactPrivacy };
export { validateV10ScriptedQaScenario as validateScriptedQaScenario };
export { validateV10ServiceRoleBoundaryContracts as validateServiceRoleBoundaryContracts };
export { validateV10StrictnessModeGates as validateStrictnessModeGates };
export { validateV10SupplyChainScripts as validateSupplyChainScripts };
export { validateV10SupportDocBoundary as validateSupportDocBoundary };
export { validateV10TenantIsolationDecision as validateTenantIsolationDecision };
export type { V10AbusePrivacyScaleSurface as AbusePrivacyScaleSurface };
export type { V10AdversarialRouteActionScenario as AdversarialRouteActionScenario };
export type { V10DatabaseHardeningContract as DatabaseHardeningContract };
export type { V10FoundationSecurityPrivacyContract as FoundationSecurityPrivacyContract };
export type { V10HardeningContract as HardeningContract };
export type { V10LegacyProofCutoverContract as LegacyProofCutoverContract };
export type { V10NegativeRiskCategory as NegativeRiskCategory };
export type { V10NegativeRiskTestPlan as NegativeRiskTestPlan };
export type { V10ProviderIntegrationBoundaryContract as ProviderIntegrationBoundaryContract };
export type { V10QualitySecurityCiCoverageCategory as QualitySecurityCiCoverageCategory };
export type { V10QualitySecurityCiCoverageGate as QualitySecurityCiCoverageGate };
export type { V10RuntimeArtifactPrivacyInput as RuntimeArtifactPrivacyInput };
export type { V10ScriptedQaScenario as ScriptedQaScenario };
export type { V10ServiceRoleBoundaryContract as ServiceRoleBoundaryContract };
export type { V10StrictnessMode as StrictnessMode };
export type { V10StrictnessModeGate as StrictnessModeGate };
export type { V10TenantIsolationDecision as TenantIsolationDecision };
// End version-name compatibility aliases.
