import { describe, expect, it } from "vitest";
import { SPEC_ARTIFACT_V10 } from "./spec-artifact-ids";
import {
  V10_ACTIVATION_STATES,
  V10_JOB_STATUSES,
  V10_WORK_ITEM_STATUSES,
} from "./release-contract";
import {
  V10_BOUNDARY_CONTRACTS,
  V10_ARTIFACT_CONTRACTS,
  V10_DATA_CLASSIFICATION_CONTRACTS,
  V10_DB_RLS_CONTRACTS,
  V10_DATA_DICTIONARY,
  V10_API_ENVIRONMENT_INTEGRATION_CONTRACTS,
  V10_AUDIT_IMMUTABILITY_PROBES,
  V10_DATA_LIFECYCLE_COMPLIANCE_CONTRACTS,
  V10_DESTRUCTIVE_OPERATION_CONTRACTS,
  V10_DIAGNOSTIC_CONTRACTS,
  V10_EDGE_CASE_MATRIX,
  V10_ENVIRONMENT_CONFIG_CONTRACTS,
  V10_FAILURE_RECOVERY_MATRIX,
  V10_LIFECYCLE_RETENTION_CONTRACTS,
  V10_LEGACY_BRIDGE_DECOMMISSION_CONTRACTS,
  V10_NOTIFICATION_COMPLIANCE_CONTRACTS,
  V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS,
  V10_OPERATOR_RUNBOOKS,
  V10_OPERATIONAL_RUNBOOK_COVERAGE,
  V10_OPS_RELEASE_READINESS_CONTRACTS,
  V10_OPERATIONAL_ALERTS,
  V10_FINAL_CUTOVER_CHECKLIST,
  V10_QUALITY_MATRIX,
  V10_POST_GA_DRIFT_CONTROLS,
  V10_PROVIDER_BOUNDARIES,
  V10_SETTINGS_HEALTH_RECOVERY_ANCHORS,
  V10_SUPPORT_DIAGNOSTIC_VIEWS,
  buildV10SupportAdminVisibilityRows,
  buildV10ProviderReadinessSnapshot,
  getV10OperationalAlertForDiagnostic,
  V10_READINESS_AUDIENCES,
  V10_ROLLOUT_RATCHETS,
  V10_SOURCE_OBJECT_TAXONOMY,
  V10_STATE_MACHINES,
  V10_TEST_TIERS,
  V10_TEST_TIER_EXECUTION_CONTRACTS,
  buildV10OperationalRecoveryManifest,
  getV10NoActionExplanation,
  getV10FailureRecoveryContract,
  getV10StateActionAvailability,
  validateV10CanaryControlDecision,
  validateV10AuditImmutabilityProbes,
  validateV10ApiEnvironmentIntegrationContracts,
  validateV10DataLifecycleComplianceContracts,
  validateV10DataDictionary,
  validateV10DataQualityRemediation,
  validateV10DestructiveOperationContracts,
  validateV10DisasterRecoveryDrill,
  validateV10EdgeCaseMatrix,
  validateV10LegacyBridgeDecommissionContracts,
  validateV10OperatorRunbooks,
  validateV10OperationalAlerts,
  validateV10PostGaDriftControls,
  validateV10ObservabilityPerformanceA11yContracts,
  validateV10OpsReleaseReadinessContracts,
  validateV10FinalCutoverChecklist,
  validateV10OperationalRunbookCoverage,
  validateV10QualityMatrix,
  validateV10ProviderBoundaries,
  validateV10StaticContractCoverage,
  validateV10SupportDiagnosticViews,
  validateV10StateMachineCompleteness,
  validateV10SupportAdminAccessRequest,
  validateV10TestTierExecutionContracts,
  v10StaticContractHasRequirement,
  validateV10StateTransition,
} from "./operational-contracts";
import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";

describe("V10 operational contracts", () => {
  it("covers failure and recovery states across user-visible domains", () => {
    expect(V10_FAILURE_RECOVERY_MATRIX.map((contract) => contract.domain)).toEqual(
      expect.arrayContaining(["jobs", "mutations", "empty_states", "hidden_features", "external_links", "reports", "exports"])
    );
    expect(getV10FailureRecoveryContract("jobs", "failed_retryable")).toMatchObject({
      recoveryAction: "retry_same_scope",
      diagnosticRequired: true,
      auditRequired: true,
    });
  });

  it("encodes state machines with terminal-state protection", () => {
    expect(V10_STATE_MACHINES.map((machine) => machine.name)).toEqual(
      expect.arrayContaining(["activation", "work_item", "evidence_request", "approval", "job"])
    );
    expect(V10_STATE_MACHINES.find((machine) => machine.name === "activation")?.states).toEqual(V10_ACTIVATION_STATES);
    expect(V10_STATE_MACHINES.find((machine) => machine.name === "work_item")?.states).toEqual(V10_WORK_ITEM_STATUSES);
    expect(V10_STATE_MACHINES.find((machine) => machine.name === "job")?.states).toEqual(V10_JOB_STATUSES);
    expect(validateV10StateTransition("activation", "workspace_prepared", "contract_uploaded_or_imported")).toEqual([]);
    expect(validateV10StateTransition("work_item", "in_progress", "done")).toEqual([]);
    expect(validateV10StateTransition("work_item", "in_progress", "completed")).toEqual(["unknown_to_state"]);
    expect(validateV10StateTransition("job", "running", "succeeded")).toEqual([]);
    expect(validateV10StateTransition("job", "succeeded", "retrying")).toEqual(["terminal_state_cannot_transition"]);
    expect(validateV10StateMachineCompleteness()).toEqual([]);
    expect(getV10StateActionAvailability("job", "failed_retryable")).toEqual(["retry_failed_job"]);
    expect(getV10NoActionExplanation("work_item", "done")).toBe("This work item is complete.");
  });

  it("captures source taxonomy, tenant, provenance, and RLS boundaries", () => {
    expect(v10StaticContractHasRequirement(V10_SOURCE_OBJECT_TAXONOMY, "external_link", "scoped_token_hash")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_DB_RLS_CONTRACTS, "tenant_isolation", "cross_org_negative_tests")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_DB_RLS_CONTRACTS, "artifacts", "private_cache_headers")).toBe(true);
  });

  it("covers edge cases, rollout ratchets, and verification tiers", () => {
    expect(validateV10EdgeCaseMatrix()).toEqual([]);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "time", "workspace_timezone")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "time", "dst_transition")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "concurrency", "idempotency_replay")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "multi_tab", "double_submit")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "multi_org", "role_downgrade_during_mutation")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "offline", "offline_retry")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "locale", "en_gb_date_copy")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "browser", "screen_reader_keyboard")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "large_data", "fifty_thousand_export_rows")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_EDGE_CASE_MATRIX, "duplicates", "generated_work_dedupe")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_ROLLOUT_RATCHETS, "ci_ratchets", "existing_v8_v9_gates_preserved")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_TEST_TIERS, "release_candidate", "objective_metrics")).toBe(true);
    expect(validateV10EdgeCaseMatrix([{ key: "time", requirements: ["workspace_timezone"] }])).toEqual(
      expect.arrayContaining([
        "edge_case_missing:concurrency",
        "edge_case_missing:multi_tab",
        "time:dst_transition_required",
        "concurrency:idempotency_replay_required",
        "offline:offline_retry_required",
        "large_data:export_scale_required",
      ])
    );
  });

  it("codifies V10 test tier execution, CI ownership, freshness, and skip policy", () => {
    expect(validateV10TestTierExecutionContracts()).toEqual([]);
    expect(V10_TEST_TIER_EXECUTION_CONTRACTS.map((contract) => contract.tier)).toEqual([
      "fast_unit",
      "focused_integration",
      "ui_component",
      "browser_e2e",
      "static_release",
      "release_candidate",
      "external_blocker",
    ]);
    expect(V10_TEST_TIER_EXECUTION_CONTRACTS.find((contract) => contract.tier === "browser_e2e")).toMatchObject({
      command: "npm run test:e2e:current-product",
      ciBlocking: true,
      covers: expect.arrayContaining(["activation", "work_reachability", "command_search"]),
      skipPolicy: "skip_requires_reason",
    });
    expect(V10_TEST_TIER_EXECUTION_CONTRACTS.find((contract) => contract.tier === "external_blocker")).toMatchObject({
      owner: "release",
      skipPolicy: "external_evidence_required",
      covers: expect.arrayContaining(["human_usability_study", "provider_configuration", "canary_review"]),
    });
    expect(
      validateV10TestTierExecutionContracts([
        {
          tier: "fast_unit",
          command: "vitest run",
          owner: "engineering",
          ciBlocking: false,
          freshnessHours: 48,
          covers: [],
          skipPolicy: "external_evidence_required",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "test_tier_missing:focused_integration",
        "fast_unit:npm_command_required",
        "fast_unit:ci_blocking_required",
        "fast_unit:freshness_24h_required",
        "fast_unit:coverage_required",
        "fast_unit:unexpected_external_evidence_policy",
      ])
    );
  });

  it("tracks diagnostics, client/server boundaries, and readiness audiences", () => {
    expect(v10StaticContractHasRequirement(V10_DIAGNOSTIC_CONTRACTS, "logging", "no_raw_contract_text")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_BOUNDARY_CONTRACTS, "client_server", "service_role_server_only")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_BOUNDARY_CONTRACTS, "ai_extraction", "prompt_injection_boundary")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_READINESS_AUDIENCES, "security", "threat_model")).toBe(true);
  });

  it("codifies classification, lifecycle, environment, notification, and artifact contracts", () => {
    const contractGroups = [
      V10_SOURCE_OBJECT_TAXONOMY,
      V10_DB_RLS_CONTRACTS,
      V10_EDGE_CASE_MATRIX,
      V10_ROLLOUT_RATCHETS,
      V10_TEST_TIERS,
      V10_DIAGNOSTIC_CONTRACTS,
      V10_BOUNDARY_CONTRACTS,
      V10_DATA_CLASSIFICATION_CONTRACTS,
      V10_LIFECYCLE_RETENTION_CONTRACTS,
      V10_ENVIRONMENT_CONFIG_CONTRACTS,
      V10_NOTIFICATION_COMPLIANCE_CONTRACTS,
      V10_ARTIFACT_CONTRACTS,
      V10_READINESS_AUDIENCES,
    ];
    for (const contracts of contractGroups) {
      expect(validateV10StaticContractCoverage(contracts)).toEqual([]);
    }
    expect(v10StaticContractHasRequirement(V10_DATA_CLASSIFICATION_CONTRACTS, "prohibited", "signed_link_tokens")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_LIFECYCLE_RETENTION_CONTRACTS, "legal_hold", "delete_blocked")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_ENVIRONMENT_CONFIG_CONTRACTS, "playwright", "credentials_or_skip_reason")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_NOTIFICATION_COMPLIANCE_CONTRACTS, "suppression", "hidden_module_suppressed")).toBe(true);
    expect(v10StaticContractHasRequirement(V10_ARTIFACT_CONTRACTS, "release_bundles", "synthetic_only")).toBe(true);
  });

  it("maps source data to privacy, retention, read models, fixtures, and redaction policies", () => {
    expect(validateV10DataDictionary()).toEqual([]);
    expect(V10_DATA_DICTIONARY.map((entry) => entry.source)).toEqual(
      expect.arrayContaining([
        "contracts",
        "contract_import_jobs",
        "evidence_requirements",
        "report_runs",
        "v10_runtime_artifacts",
        "v10_mutation_idempotency",
        "v10_audit_events",
        "v10_release_evidence_records",
      ])
    );
    expect(V10_DATA_DICTIONARY.find((entry) => entry.source === "evidence_requirements")).toMatchObject({
      retentionClass: "external_link_expiring",
      redactionPolicy: "token_hash_only",
    });
    expect(V10_DATA_DICTIONARY.find((entry) => entry.source === "contracts")?.readModelTargets).toEqual(
      expect.arrayContaining(["v10_read_model_rows", "v10_work_items"])
    );
    expect(V10_DATA_DICTIONARY.find((entry) => entry.source === "v10_runtime_artifacts")).toMatchObject({
      retentionClass: "artifact_expiring",
      redactionPolicy: "support_safe",
      readModelTargets: expect.arrayContaining(["v10_report_run_visibility", "v10_job_run_visibility"]),
    });
    expect(V10_DATA_DICTIONARY.find((entry) => entry.source === "v10_mutation_idempotency")).toMatchObject({
      privacyClass: "audit_safe",
      retentionClass: "audit_retained",
    });
    expect(
      validateV10DataDictionary([
        {
          source: "external_link",
          owner: "security",
          privacyClass: "server_safe",
          retentionClass: "external_link_expiring",
          readModelTargets: [],
          fixtureTargets: [],
          redactionPolicy: "support_safe",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "external_link:read_model_target_required",
        "external_link:fixture_target_required",
        "external_link:external_link_token_hash_required",
      ])
    );
  });

  it("hardens provider configuration and public/private environment boundaries", () => {
    expect(validateV10ProviderBoundaries()).toEqual([]);
    expect(V10_PROVIDER_BOUNDARIES.map((boundary) => boundary.provider)).toEqual(
      expect.arrayContaining(["supabase", "resend", "openai", "stripe", "vercel_cron", "storage", "malware_scan", "signed_url", "playwright"])
    );
    expect(V10_PROVIDER_BOUNDARIES.find((boundary) => boundary.provider === "supabase")).toMatchObject({
      privacyBoundary: "service_role_server_only",
      releaseBlockerWhenMissing: true,
    });
    expect(
      validateV10ProviderBoundaries([
        {
          provider: "supabase",
          requiredServerEnv: ["NEXT_PUBLIC_SECRET"],
          publicEnvAllowed: ["SUPABASE_SERVICE_ROLE_KEY"],
          outageState: "bad",
          privacyBoundary: "service_role_server_only",
          releaseBlockerWhenMissing: true,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "provider_missing:resend",
        "supabase:server_secret_must_not_be_public",
        "supabase:public_env_must_be_prefixed",
        "supabase:outage_state_required",
      ])
    );
    const readiness = buildV10ProviderReadinessSnapshot({
      SUPABASE_SERVICE_ROLE_KEY: "present",
      NEXT_PUBLIC_SUPABASE_URL: "present",
      CRON_SECRET: "present",
    });
    expect(readiness.find((row) => row.provider === "supabase")).toMatchObject({
      ready: true,
      outageState: "none",
      releaseBlocker: false,
      recoveryDestination: "/settings/health#providers",
    });
    expect(readiness.find((row) => row.provider === "resend")).toMatchObject({
      ready: false,
      missingEnv: ["RESEND_API_KEY"],
      outageState: "email_provider_unavailable",
      releaseBlocker: true,
    });
  });

  it("ties cron, diagnostics, retention, SLO, canary, rollback, and support handoff into release readiness", () => {
    expect(validateV10OpsReleaseReadinessContracts()).toEqual([]);
    expect(V10_OPS_RELEASE_READINESS_CONTRACTS.map((contract) => contract.key)).toEqual([
      "read_model_refresh",
      "idempotency_cleanup",
      "runtime_artifact_cleanup",
      "provider_readiness",
      "slo_canary",
      "support_handoff",
      "rollback_repair",
    ]);
    expect(V10_OPS_RELEASE_READINESS_CONTRACTS.find((contract) => contract.key === "read_model_refresh")).toMatchObject({
      cronRoute: "src/app/api/cron/v10/read-model-refresh/route.ts",
      providerBlockers: expect.arrayContaining(["supabase", "vercel_cron"]),
      recoveryDestination: "/settings/health#read-models",
    });
    expect(V10_OPS_RELEASE_READINESS_CONTRACTS.find((contract) => contract.key === "runtime_artifact_cleanup")).toMatchObject({
      retentionDays: 30,
      providerBlockers: expect.arrayContaining(["storage", "signed_url"]),
    });
    for (const contract of V10_OPS_RELEASE_READINESS_CONTRACTS) {
      const anchor = contract.recoveryDestination.split("#")[1];
      if (anchor) expect(V10_SETTINGS_HEALTH_RECOVERY_ANCHORS, contract.key).toContain(anchor);
    }
    expect(
      validateV10OpsReleaseReadinessContracts([
        {
          key: "read_model_refresh",
          owner: "engineering",
          cronRoute: "src/app/api/cron/v4/read-model-refresh/route.ts",
          diagnosticPrefix: "read_model",
          retentionDays: 0,
          sloDashboardKey: "",
          rollbackCommand: "",
          recoveryDestination: "/debug",
          providerBlockers: ["supabase"],
          releaseEvidenceKey: "read-model",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "ops_readiness_missing:idempotency_cleanup",
        "read_model_refresh:cron_route_must_be_v10",
        "read_model_refresh:diagnostic_prefix_required",
        "read_model_refresh:retention_required",
        "read_model_refresh:slo_dashboard_required",
        "read_model_refresh:rollback_command_required",
        "read_model_refresh:settings_health_recovery_required",
        "read_model_refresh:release_evidence_key_required",
      ])
    );
    expect(
      validateV10OpsReleaseReadinessContracts([
        ...V10_OPS_RELEASE_READINESS_CONTRACTS.filter((contract) => contract.key !== "slo_canary"),
        {
          ...V10_OPS_RELEASE_READINESS_CONTRACTS.find((contract) => contract.key === "slo_canary")!,
          recoveryDestination: "/settings/health#missing-anchor",
        },
      ])
    ).toContain("slo_canary:settings_health_anchor_missing:missing-anchor");
  });

  it("governs destructive, revocation, retry, rollback, and kill-switch operations", () => {
    expect(validateV10DestructiveOperationContracts()).toEqual([]);
    expect(V10_DESTRUCTIVE_OPERATION_CONTRACTS.map((contract) => contract.operation)).toEqual(
      expect.arrayContaining([
        "archive_contract",
        "delete_contract",
        "restore_contract",
        "revoke_export_artifact",
        "revoke_evidence_link",
        "cancel_job",
        "retry_job",
        "release_rollback",
        "incident_kill_switch",
      ])
    );
    expect(V10_DESTRUCTIVE_OPERATION_CONTRACTS.find((contract) => contract.operation === "delete_contract")).toMatchObject({
      reversible: false,
      readModelRefreshRequired: true,
    });
    expect(
      validateV10DestructiveOperationContracts([
        {
          operation: "delete_contract",
          requiresExpectedVersion: true,
          requiresAudit: false,
          requiresIdempotency: false,
          requiresReason: false,
          reversible: false,
          readModelRefreshRequired: true,
          customerSafeWarning: "Expose raw token.",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "operation_missing:archive_contract",
        "delete_contract:audit_required",
        "delete_contract:idempotency_required",
        "delete_contract:reason_required",
        "delete_contract:customer_safe_warning_required",
      ])
    );
  });

  it("validates support/admin and break-glass access boundaries", () => {
    expect(
      validateV10SupportAdminAccessRequest(
        {
          accessLevel: "break_glass",
          organizationId: "org_1",
          actorId: "support_1",
          reason: "Restore failed release evidence.",
          auditEventId: "audit_1",
          approvedBy: "security_1",
          expiresAt: "2026-04-25T01:00:00Z",
          supportSafeOnly: true,
        },
        new Date("2026-04-25T00:00:00Z")
      )
    ).toEqual([]);
    expect(validateV10SupportAdminAccessRequest({ accessLevel: "service_role" })).toEqual(
      expect.arrayContaining([
        "organization_scope_required",
        "actor_required",
        "reason_required",
        "audit_event_required",
        "support_access_must_be_support_safe",
        "service_role_requires_approval",
      ])
    );
    expect(
      validateV10SupportAdminAccessRequest(
        {
          accessLevel: "break_glass",
          organizationId: "org_1",
          actorId: "support_1",
          reason: "Investigate failed refresh.",
          auditEventId: "audit_1",
          approvedBy: "security_1",
          expiresAt: "2026-04-24T00:00:00Z",
          supportSafeOnly: true,
        },
        new Date("2026-04-25T00:00:00Z")
      )
    ).toEqual(["access_expired"]);
    expect(validateV10SupportDiagnosticViews()).toEqual([]);
    expect(V10_SUPPORT_DIAGNOSTIC_VIEWS.find((view) => view.key === "external_link")).toMatchObject({
      impersonationAllowed: false,
      escalationOwner: "security",
    });
    expect(
      validateV10SupportDiagnosticViews([
        {
          key: "unsafe",
          allowedAccessLevels: ["support"],
          fields: ["token"],
          prohibitedFields: ["token"],
          impersonationAllowed: true,
          escalationOwner: "support",
          remediationCopy: "Show the raw token.",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "unsafe:impersonation_not_allowed",
        "unsafe:customer_safe_remediation_required",
        "unsafe:prohibited_field_exposed:token",
      ])
    );
  });

  it("exposes incident, evidence freshness, and escalation visibility by support/admin audience", () => {
    expect(validateV10OperationalAlerts()).toEqual([]);
    expect(V10_OPERATIONAL_ALERTS.map((alert) => alert.key)).toEqual(
      expect.arrayContaining([
        "read_model_refresh_failure",
        "release_evidence_stale",
        "external_link_failures",
        "idempotency_rpc_failures",
        "audit_write_failures",
        "command_index_partial",
      ])
    );
    expect(getV10OperationalAlertForDiagnostic("v10_read_model_refresh")).toMatchObject({
      severity: "critical",
      incidentState: "open",
      evidenceFreshness: "stale",
      escalationOwner: "engineering",
    });
    expect(buildV10SupportAdminVisibilityRows("support").map((row) => row.key)).toEqual(
      expect.arrayContaining(["read_model_refresh_failure", "external_link_failures", "idempotency_rpc_failures", "audit_write_failures"])
    );
    expect(buildV10SupportAdminVisibilityRows("admin").map((row) => row.key)).toEqual(
      expect.arrayContaining(["read_model_refresh_failure", "release_evidence_stale", "external_link_failures"])
    );
    expect(buildV10SupportAdminVisibilityRows("user")).toEqual([]);
    expect(
      validateV10OperationalAlerts([
        {
          key: "unsafe",
          diagnosticId: "diag_1",
          severity: "critical",
          audiences: [],
          incidentState: "none",
          evidenceFreshness: "missing",
          escalationOwner: "support",
          recoveryDestination: "settings",
          customerSafeCopy: "Show the raw signed url token.",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "unsafe:diagnostic_id_required",
        "unsafe:audience_required",
        "unsafe:recovery_destination_required",
        "unsafe:customer_safe_copy_required",
        "unsafe:critical_incident_state_required",
      ])
    );
  });

  it("checks audit immutability probes for append-only and compensating-event behavior", () => {
    expect(validateV10AuditImmutabilityProbes()).toEqual([]);
    expect(V10_AUDIT_IMMUTABILITY_PROBES.map((probe) => probe.table)).toEqual(
      expect.arrayContaining(["v10_audit_events", "v10_release_evidence_records", "v10_mutation_idempotency", "v10_runtime_artifacts"])
    );
    expect(
      validateV10AuditImmutabilityProbes([
        {
          table: "v10_audit_events",
          operation: "delete",
          actorServerDerived: false,
          compensatingEventId: null,
          metadataSupportSafe: false,
          evidenceKey: "unsafe",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "v10_audit_events:actor_server_derived_required",
        "v10_audit_events:support_safe_metadata_required",
        "v10_audit_events:audit_evidence_key_required",
        "v10_audit_events:append_only_required",
        "v10_audit_events:compensating_event_required",
        "immutability_probe_missing:v10_release_evidence_records",
      ])
    );
  });

  it("keeps post-GA SLO, drift, incident, rollback, and evidence freshness controls live", () => {
    expect(validateV10PostGaDriftControls()).toEqual([]);
    expect(V10_POST_GA_DRIFT_CONTROLS.map((control) => control.key)).toEqual([
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
    ]);
    expect(V10_POST_GA_DRIFT_CONTROLS.find((control) => control.key === "read_model_drift")).toMatchObject({
      checkCommand: "node scripts/rebuild-read-models.mjs --dry-run",
      recoveryDestination: "/settings/health#read-models",
      evidenceFreshnessHours: 6,
    });
    expect(
      validateV10PostGaDriftControls([
        {
          key: "post_ga_slo_7_day",
          owner: "operations",
          checkCommand: "curl dashboard",
          dashboardKey: "",
          evidenceFreshnessHours: 0,
          recoveryDestination: "/dashboard",
          rollbackCommand: "rollback",
          supportSafeEscalation: "Show raw credential.",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "post_ga_control_missing:post_ga_slo_30_day",
        "post_ga_slo_7_day:check_command_required",
        "post_ga_slo_7_day:dashboard_key_required",
        "post_ga_slo_7_day:freshness_window_required",
        "post_ga_slo_7_day:settings_health_recovery_required",
        "post_ga_slo_7_day:rollback_command_required",
        "post_ga_slo_7_day:support_safe_escalation_required",
      ])
    );
  });

  it("closes API, environment, provider, entitlement, cache, and version compatibility contracts", () => {
    expect(validateV10ApiEnvironmentIntegrationContracts()).toEqual([]);
    expect(V10_API_ENVIRONMENT_INTEGRATION_CONTRACTS.map((contract) => contract.key)).toEqual([
      "request_response_schema",
      "cache_policy",
      "environment_parity",
      "entitlement_billing_sync",
      "integration_boundary",
      "pagination_filtering_sorting",
      "version_compatibility",
      "concurrency_time_bounds",
    ]);
    expect(V10_API_ENVIRONMENT_INTEGRATION_CONTRACTS.find((contract) => contract.key === "version_compatibility")).toMatchObject({
      runtimeArtifact: "src/lib/mutation-envelope.ts",
      compatibilityBoundary: "v10_api_response_schemas",
      rateLimitPolicy: "mutation",
    });
    expect(
      validateV10ApiEnvironmentIntegrationContracts([
        {
          key: "cache_policy",
          owner: "security",
          runtimeArtifact: SPEC_ARTIFACT_V10,
          negativeTestArtifact: SPEC_ARTIFACT_V10,
          cachePolicy: "private_no_store",
          requiredEnvKeys: ["NEXT_PUBLIC_SECRET_KEY"],
          compatibilityBoundary: "cache",
          rateLimitPolicy: "standard_user",
          releaseGate: "node check.js",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "api_env_contract_missing:request_response_schema",
        "cache_policy:runtime_artifact_required",
        "cache_policy:negative_test_required",
        "cache_policy:public_secret_env_forbidden",
        "cache_policy:compatibility_boundary_required",
        "cache_policy:release_gate_required",
      ])
    );
  });

  it("covers data lifecycle, privacy, compliance evidence, and support-safe diagnostics", () => {
    expect(validateV10DataLifecycleComplianceContracts()).toEqual([]);
    expect(V10_DATA_LIFECYCLE_COMPLIANCE_CONTRACTS.map((contract) => contract.operation)).toEqual([
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
    ]);
    expect(V10_DATA_LIFECYCLE_COMPLIANCE_CONTRACTS.find((contract) => contract.operation === "external_link_revocation")).toMatchObject({
      privacyRedaction: "token_hash_only",
      auditAction: "external_link.revoked",
      complianceEvidenceKey: "compliance:external_link_revocation",
    });
    expect(
      validateV10DataLifecycleComplianceContracts([
        {
          operation: "external_link_revocation",
          retentionPolicy: "",
          privacyRedaction: "support_safe",
          auditAction: "external_link_revoked",
          supportBoundary: "",
          customerSafeDiagnostic: "Expose raw token.",
          cleanupCommand: "cleanup",
          complianceEvidenceKey: "external_link",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "lifecycle_operation_missing:create",
        "external_link_revocation:retention_policy_required",
        "external_link_revocation:audit_action_required",
        "external_link_revocation:support_boundary_required",
        "external_link_revocation:customer_safe_diagnostic_required",
        "external_link_revocation:cleanup_command_required",
        "external_link_revocation:compliance_evidence_key_required",
        "external_link_revocation:token_hash_redaction_required",
      ])
    );
  });

  it("defines legacy bridge decommission criteria with runtime checks and rollback plans", () => {
    expect(validateV10LegacyBridgeDecommissionContracts()).toEqual([]);
    expect(V10_LEGACY_BRIDGE_DECOMMISSION_CONTRACTS.map((contract) => contract.bridge)).toEqual([
      "v4_actions",
      "v6_settings",
      "v8_surface_guard",
      "v9_telemetry",
      "legacy_report_pack",
    ]);
    expect(V10_LEGACY_BRIDGE_DECOMMISSION_CONTRACTS.find((contract) => contract.bridge === "v9_telemetry")).toMatchObject({
      runtimeUsageCheck: "npm run check:release-evidence",
      compatibilityBoundary: "objective_telemetry",
    });
    expect(
      validateV10LegacyBridgeDecommissionContracts([
        {
          bridge: "v4_actions",
          owner: "engineering",
          replacementArtifact: "",
          runtimeUsageCheck: "node check",
          removalGate: "",
          rollbackPlan: "",
          compatibilityBoundary: "",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "v4_actions:replacement_artifact_required",
        "v4_actions:runtime_usage_check_required",
        "v4_actions:removal_gate_required",
        "v4_actions:rollback_plan_required",
        "v4_actions:compatibility_boundary_required",
        "legacy_bridge_missing:v6_settings",
      ])
    );
  });

  it("validates disaster recovery, rollout canary, and data remediation decisions", () => {
    expect(
      validateV10DisasterRecoveryDrill({
        scope: "read_model_rebuild",
        owner: "ops",
        backupVerified: true,
        restoreTested: true,
        replaySafe: true,
        privateDataLeakCheckPassed: true,
        evidenceCapturedAt: "2026-04-25T00:00:00Z",
      })
    ).toEqual([]);
    expect(validateV10CanaryControlDecision({ state: "GA", unresolvedBlockers: ["privacy-review"] })).toEqual(
      expect.arrayContaining([
        "organization_scope_required",
        "fresh_metrics_required",
        "kill_switch_required",
        "rollback_readiness_required",
        "unresolved_blockers_must_pause_or_rollback",
        "owner_signoff_required",
      ])
    );
    expect(validateV10DisasterRecoveryDrill({ scope: "read_model_rebuild" })).toEqual(
      expect.arrayContaining([
        "owner_required",
        "backup_verification_required",
        "restore_test_required",
        "safe_replay_required",
        "privacy_leak_check_required",
        "evidence_capture_required",
      ])
    );
    expect(
      validateV10CanaryControlDecision({
        state: "paused",
        unresolvedBlockers: ["privacy-review"],
      })
    ).not.toContain("unresolved_blockers_must_pause_or_rollback");
    expect(
      validateV10DataQualityRemediation({
        gap: "missing_dates",
        visibleWorkCreated: true,
        remediationAction: "request_approved_dates",
        auditEventId: "audit_2",
        telemetryOutcome: "remediation_created",
      })
    ).toEqual([]);
    expect(validateV10DataQualityRemediation({ gap: "missing_dates" })).toEqual([
      "visible_work_required",
      "remediation_action_required",
      "audit_event_required",
      "telemetry_outcome_required",
    ]);
  });

  it("defines support-safe operator runbooks without treating docs as completion proof", () => {
    expect(validateV10OperatorRunbooks()).toEqual([]);
    expect(V10_OPERATOR_RUNBOOKS.map((runbook) => runbook.key)).toEqual([
      "read_model_repair",
      "failed_job_retry",
      "provider_outage",
      "canary_hold",
      "release_rollback",
    ]);
    expect(V10_OPERATOR_RUNBOOKS.find((runbook) => runbook.key === "provider_outage")).toMatchObject({
      owner: "operations",
      completionProof: "release_evidence_record",
    });
    expect(buildV10OperationalRecoveryManifest({ runbookKey: "read_model_repair", diagnosticSuffix: "stale_dashboard" })).toEqual({
      runbook_key: "read_model_repair",
      owner: "operations",
      diagnostic_id: "v10_read_model_stale_dashboard",
      recovery_destination: "/settings/health#read-models",
      customer_safe_copy: "Workspace data is refreshing. Review health for recovery progress.",
      completion_proof: "audit_event",
      requires_kill_switch_review: false,
      requires_read_model_repair: true,
      requires_artifact_revocation: false,
    });
    expect(buildV10OperationalRecoveryManifest({ runbookKey: "release_rollback", artifactRevocation: true })).toMatchObject({
      diagnostic_id: "v10_rollback_manual_review",
      requires_kill_switch_review: true,
      requires_artifact_revocation: true,
    });
    expect(buildV10OperationalRecoveryManifest({ runbookKey: "unknown" })).toBeNull();
    expect(
      validateV10OperatorRunbooks([
        {
          key: "unsafe",
          owner: "support",
          trigger: "",
          diagnosticPrefix: "diag",
          recoveryDestination: "settings",
          customerSafeCopy: "Show raw contract text and token.",
          completionProof: "audit_event",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "unsafe:trigger_required",
        "unsafe:v10_diagnostic_prefix_required",
        "unsafe:recovery_destination_required",
        "unsafe:customer_safe_copy_violation",
        "runbook_missing:read_model_repair",
      ])
    );
  });

  it("covers every operational runbook named by the final release plan", () => {
    expect(validateV10OperationalRunbookCoverage()).toEqual([]);
    expect(V10_OPERATIONAL_RUNBOOK_COVERAGE.map((row) => row.key)).toEqual([
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
    ]);
    expect(V10_OPERATIONAL_RUNBOOK_COVERAGE.find((row) => row.key === "audit_write_failure")).toMatchObject({
      owner: "security",
      recoveryDestination: "/settings/health#support",
      releaseEvidenceKey: "ops:audit_write_failure",
      supportSafe: true,
    });
    expect(
      validateV10OperationalRunbookCoverage([
        {
          key: "read_model_rebuild",
          owner: "engineering",
          trigger: "",
          command: "curl",
          recoveryDestination: "settings",
          releaseEvidenceKey: "read-model" as never,
          supportSafe: false,
          incidentReadinessCheck: "",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "runbook_coverage_missing:idempotency_cleanup",
        "read_model_rebuild:trigger_required",
        "read_model_rebuild:command_required",
        "read_model_rebuild:recovery_destination_required",
        "read_model_rebuild:release_evidence_key_required",
        "read_model_rebuild:support_safe_required",
        "read_model_rebuild:incident_readiness_check_required",
      ])
    );
  });

  it("locks accessibility, performance, browser, responsive, and visual coverage across V10 surfaces", () => {
    expect(validateV10QualityMatrix()).toEqual([]);
    expect(V10_QUALITY_MATRIX.map((row) => row.surface)).toEqual(
      expect.arrayContaining(["home", "work", "contract_detail", "command_palette", "external_evidence_submission"])
    );
    expect(V10_QUALITY_MATRIX.find((row) => row.surface === "contract_detail")).toMatchObject({
      responsiveViewports: expect.arrayContaining(["1440x900"]),
      performanceBudget: "trust_header_under_900ms",
      browserCoverage: expect.arrayContaining(["chromium", "webkit", "firefox"]),
    });
    expect(
      validateV10QualityMatrix([
        {
          surface: "home",
          accessibilityCoverage: [],
          keyboardCoverage: [],
          screenReaderCoverage: [],
          responsiveViewports: ["1024"],
          performanceBudget: "fast",
          browserCoverage: ["chromium"],
          visualRegressionSmoke: false,
          evidenceKey: "home" as never,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "quality_surface_missing:work",
        "home:accessibility_required",
        "home:keyboard_required",
        "home:screen_reader_required",
        "home:mobile_viewport_required",
        "home:tablet_viewport_required",
        "home:performance_budget_required",
        "home:browser_required:webkit",
        "home:browser_required:firefox",
        "home:visual_regression_smoke_required",
        "home:quality_evidence_key_required",
      ])
    );
  });

  it("freezes final cutover, compatibility, hidden P1/P2, and handoff gates", () => {
    expect(validateV10FinalCutoverChecklist()).toEqual([]);
    expect(V10_FINAL_CUTOVER_CHECKLIST.map((row) => row.key)).toEqual([
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
    ]);
    expect(V10_FINAL_CUTOVER_CHECKLIST.find((row) => row.key === "complete_promotion")).toMatchObject({
      releaseState: "complete",
      gateCommand: "npm run check:release-evidence -- --post-ga 30d",
      residualRiskPolicy: "block",
    });
    expect(
      validateV10FinalCutoverChecklist([
        {
          key: "complete_promotion",
          releaseState: "GA",
          owner: "release",
          gateCommand: "curl",
          blocksPromotion: false,
          evidenceKey: "complete" as never,
          residualRiskPolicy: "monitor_post_ga",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "cutover_check_missing:no_exclusions_matrix",
        "complete_promotion:gate_command_required",
        "complete_promotion:must_block_promotion",
        "complete_promotion:cutover_evidence_key_required",
        "complete_promotion:complete_state_required",
        "complete_promotion:monitor_post_ga_requires_complete_state",
      ])
    );
  });

  it("covers observability, performance budgets, accessibility states, scale fixtures, and support diagnostics", () => {
    expect(validateV10ObservabilityPerformanceA11yContracts()).toEqual([]);
    expect(V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS.map((contract) => contract.surface)).toEqual(
      expect.arrayContaining(["home", "work", "contract_record", "command_palette", "reports_exports", "settings_health"])
    );
    expect(V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS.find((contract) => contract.surface === "work")).toMatchObject({
      telemetrySignals: expect.arrayContaining(["product.v10.work_item_completed"]),
      accessibilityStates: expect.arrayContaining(["focus_returns_to_completed_row"]),
      supportDiagnosticFields: expect.arrayContaining(["diagnostic_id"]),
    });
    const allowlistedActions = new Set(PRODUCT_TELEMETRY_ACTIONS);
    for (const contract of V10_OBSERVABILITY_PERFORMANCE_A11Y_CONTRACTS) {
      for (const signal of contract.telemetrySignals) {
        expect(allowlistedActions.has(signal as (typeof PRODUCT_TELEMETRY_ACTIONS)[number]), signal).toBe(true);
      }
    }
    expect(
      validateV10ObservabilityPerformanceA11yContracts([
        {
          surface: "home",
          telemetrySignals: ["legacy.event"],
          alertThresholds: [],
          performanceBudgets: ["fast"],
          accessibilityStates: ["visible"],
          scaleFixture: "",
          supportDiagnosticFields: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "surface_missing:work",
        "home:telemetry_signal_must_be_v10",
        "home:alert_threshold_required",
        "home:performance_budget_required",
        "home:accessibility_state_required",
        "home:scale_fixture_required",
        "home:diagnostic_id_field_required",
      ])
    );
  });
});
