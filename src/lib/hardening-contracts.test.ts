import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SPEC_ARTIFACT_V10, SPEC_ARTIFACT_V9_ARCHIVE } from "./spec-artifact-ids";
import {
  V10_ADVERSARIAL_TEST_CONTRACTS,
  V10_ADVERSARIAL_ROUTE_ACTION_SCENARIOS,
  V10_ABUSE_PRIVACY_SCALE_SURFACES,
  V10_API_SNAPSHOT_CONTRACTS,
  V10_DEPENDENCY_SUPPLY_CHAIN_CONTRACTS,
  V10_DATABASE_HARDENING_CONTRACTS,
  V10_DEPRECATION_CLEANUP_CONTRACTS,
  V10_ERROR_BUDGET_AUDIT_CONTRACTS,
  V10_FOUNDATION_SECURITY_PRIVACY_CONTRACTS,
  V10_HARDENING_CONTRACTS,
  V10_LEGACY_PROOF_CUTOVER_CONTRACTS,
  V10_NOTIFICATION_DEDUPE_CONTRACTS,
  V10_NEGATIVE_RISK_TEST_PLANS,
  V10_PERSONA_WORKSPACE_COVERAGE,
  V10_PRIVACY_SAFE_COPY_CATALOG,
  V10_PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS,
  V10_QUALITY_SECURITY_CI_COVERAGE_GATES,
  V10_RECONCILIATION_JOB_CONTRACTS,
  V10_REQUIREMENT_ID_CONTRACTS,
  V10_SCRIPTED_QA_CONTRACTS,
  V10_SERVICE_ROLE_BOUNDARY_CONTRACTS,
  V10_STRICTNESS_MODE_GATES,
  V10_SUPPORT_DOC_BOUNDARY_CONTRACTS,
  getV10EvidenceDependencyOrder,
  getV10StrictnessMode,
  isV10CopyPrivacySafe,
  sanitizeV10DiagnosticMetadata,
  sanitizeV10InternalHref,
  validateV10DeprecationCleanupDecision,
  validateV10AbusePrivacyScaleSurfaces,
  validateV10AdversarialRouteActionScenario,
  validateV10AdversarialRouteActionScenarioSet,
  validateV10DatabaseHardeningContracts,
  validateV10FoundationSecurityPrivacyContracts,
  validateV10LegacyProofCutoverContracts,
  validateV10NegativeRiskTestPlans,
  validateV10ProviderIntegrationBoundaryContracts,
  validateV10QualitySecurityCiCoverageGates,
  validateV10RuntimeArtifactPrivacy,
  validateV10ScriptedQaScenario,
  validateV10ServiceRoleBoundaryContracts,
  validateV10StrictnessModeGates,
  validateV10SupplyChainScripts,
  validateV10SupportDocBoundary,
  validateV10TenantIsolationDecision,
  v10HardeningContractHasRequirement,
} from "./hardening-contracts";

describe("V10 final hardening contracts", () => {
  it("keeps status, action, diagnostic, and no-action copy privacy safe", () => {
    const copy = [
      ...Object.values(V10_PRIVACY_SAFE_COPY_CATALOG.statuses),
      ...Object.values(V10_PRIVACY_SAFE_COPY_CATALOG.actions),
      ...Object.values(V10_PRIVACY_SAFE_COPY_CATALOG.diagnostics),
    ];
    expect(copy.length).toBeGreaterThan(10);
    expect(copy.every(isV10CopyPrivacySafe)).toBe(true);
    expect(isV10CopyPrivacySafe("Show raw contract text")).toBe(false);
    expect(
      sanitizeV10DiagnosticMetadata({
        diagnostic_id: "diag_1",
        retry_count: 2,
        provider_error: "Provider failed while fetching https://private.example/file.pdf",
        raw_contract_text: "secret",
        responder_email: "external@example.com",
      })
    ).toEqual({
      safe: { diagnostic_id: "diag_1", retry_count: 2, provider_error: "redacted" },
      droppedKeys: ["raw_contract_text", "responder_email"],
    });
    expect(isV10CopyPrivacySafe("Open provider error with filename")).toBe(false);
    expect(sanitizeV10InternalHref("/contracts/abc?tab=obligations")).toBe("/contracts/abc?tab=obligations");
    expect(sanitizeV10InternalHref("https://private.example/contracts/abc")).toBe("/work");
    expect(sanitizeV10InternalHref("/api/export/contracts/job?token=secret")).toBe("/work");
    expect(sanitizeV10InternalHref("//evil.example/path")).toBe("/work");
  });

  it("enforces runtime artifact classification, retention, and signed-link privacy", () => {
    expect(
      validateV10RuntimeArtifactPrivacy(
        {
          artifactKind: "report",
          classification: "support_safe",
          accessScope: "organization",
          href: "/api/reports/report_1",
          checksum: "sha256:report",
          expiresAt: "2026-05-01T00:00:00Z",
          visibilityState: "visible",
        },
        new Date("2026-04-26T00:00:00Z")
      )
    ).toEqual([]);
    expect(
      validateV10RuntimeArtifactPrivacy(
        {
          artifactKind: "export",
          classification: "customer_private",
          accessScope: "organization",
          href: "https://storage.example/export.csv?token=secret",
          checksum: null,
          expiresAt: "2026-04-01T00:00:00Z",
          revokedAt: "2026-04-02T00:00:00Z",
          visibilityState: "visible",
        },
        new Date("2026-04-26T00:00:00Z")
      )
    ).toEqual(
      expect.arrayContaining([
        "customer_private_artifact_requires_narrow_scope",
        "artifact_href_must_not_expose_signed_url",
        "expired_artifact_must_be_archived_or_revoked",
        "revoked_artifact_must_not_be_visible",
        "artifact_checksum_required",
      ])
    );
  });

  it("requires tenant denials to hide existence and keep diagnostics support-safe", () => {
    expect(
      validateV10TenantIsolationDecision({
        actorOrganizationId: "org_1",
        targetOrganizationId: "org_2",
        targetExists: true,
        responseStatus: 404,
        outcome: "not_found",
        diagnosticId: "v10_cross_tenant_denied",
        cacheControl: "private, no-store",
        supportSafeMetadata: { route: "export_job", retryable: false },
      })
    ).toEqual([]);
    expect(
      validateV10TenantIsolationDecision({
        actorOrganizationId: "org_1",
        targetOrganizationId: "org_2",
        targetExists: true,
        responseStatus: 403,
        outcome: "forbidden",
        diagnosticId: "denied",
        cacheControl: "public, max-age=60",
        supportSafeMetadata: {
          target_exists: true,
          target_organization_id: "org_2",
          raw_contract_text: "private clause",
        },
      })
    ).toEqual(
      expect.arrayContaining([
        "tenant_denial_must_not_confirm_existence",
        "tenant_denial_outcome_must_be_not_found",
        "tenant_denial_v10_diagnostic_required",
        "tenant_denial_private_no_store_required",
        "tenant_denial_support_metadata_must_be_safe",
        "tenant_denial_metadata_must_not_confirm_target",
      ])
    );
  });

  it("locks foundation security, privacy, cache, eligibility, and support diagnostics as one release gate", () => {
    expect(validateV10FoundationSecurityPrivacyContracts()).toEqual([]);
    expect(V10_FOUNDATION_SECURITY_PRIVACY_CONTRACTS.map((contract) => contract.key)).toEqual([
      "tenant_isolation",
      "eligibility",
      "audit_metadata",
      "cache_headers",
      "support_diagnostics",
      "external_artifacts",
    ]);
    expect(V10_FOUNDATION_SECURITY_PRIVACY_CONTRACTS.find((contract) => contract.key === "tenant_isolation")).toMatchObject({
      requiredOutcomes: expect.arrayContaining(["not_found", "private_no_store"]),
      forbiddenSignals: expect.arrayContaining(["target_exists", "target_organization_id", "raw_contract_text"]),
    });
    expect(V10_HARDENING_CONTRACTS.map((contract) => contract.key)).toContain("foundation:tenant_isolation");
    expect(
      validateV10FoundationSecurityPrivacyContracts([
        {
          key: "tenant_isolation",
          enforcedBy: [],
          requiredOutcomes: ["forbidden"],
          forbiddenSignals: [],
          releaseProof: "api",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "foundation_security_missing:eligibility",
        "tenant_isolation:enforcement_artifact_required",
        "tenant_isolation:forbidden_signal_required",
        "tenant_isolation:must_hide_existence",
      ])
    );
  });

  it("keeps service-role access bounded by org predicates, cache policy, audit, and safe diagnostics", () => {
    expect(validateV10ServiceRoleBoundaryContracts()).toEqual([]);
    expect(V10_SERVICE_ROLE_BOUNDARY_CONTRACTS.map((contract) => contract.artifact)).toEqual(
      expect.arrayContaining([
        "src/lib/read-model-refresh.ts",
        "src/app/api/export/contracts/route.ts",
        "src/app/api/cron/v10/idempotency-cleanup/route.ts",
      ])
    );
    expect(
      validateV10ServiceRoleBoundaryContracts([
        {
          artifact: "src/app/api/export/contracts/route.ts",
          operation: "write",
          tables: ["contracts"],
          organizationPredicate: null,
          serviceRoleJustification: "",
          cachePolicy: "not_applicable",
          auditRequired: true,
          supportSafeDiagnostics: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "src/app/api/export/contracts/route.ts:justification_required",
        "src/app/api/export/contracts/route.ts:organization_predicate_required",
        "src/app/api/export/contracts/route.ts:private_no_store_required",
        "src/app/api/export/contracts/route.ts:audit_justification_required",
        "src/app/api/export/contracts/route.ts:support_safe_diagnostics_required",
      ])
    );
  });

  it("verifies provider and tooling boundaries with degraded states and release blockers", () => {
    expect(validateV10ProviderIntegrationBoundaryContracts()).toEqual([]);
    const semgrepRulepack = readFileSync(join(process.cwd(), "semgrep/oblixa-v10-surface.yml"), "utf8");
    expect(V10_PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS.map((contract) => contract.provider)).toEqual([
      "supabase",
      "vercel",
      "resend",
      "openai",
      "stripe",
      "playwright",
      "vitest",
      "semgrep",
    ]);
    expect(V10_PROVIDER_INTEGRATION_BOUNDARY_CONTRACTS.find((contract) => contract.provider === "semgrep")).toMatchObject({
      releaseBlockerKey: "provider:semgrep",
      privacyBoundary: expect.arrayContaining(["raw_contract_text_rule", "signed_url_rule"]),
    });
    expect(semgrepRulepack).toContain("oblixa-v10-telemetry-no-private-detail-keys");
    expect(semgrepRulepack).toContain("oblixa-v10-mutation-actor-must-be-server-derived");
    expect(semgrepRulepack).toContain("oblixa-v10-mutation-next-destination-no-unsafe-query");
    expect(semgrepRulepack).toContain("raw_contract_text");
    expect(semgrepRulepack).toContain("signed_url");
    expect(semgrepRulepack).not.toMatch(/severity:\s*(INFO|WARNING)\b/);
    expect(semgrepRulepack.match(/severity:\s*ERROR\b/g)?.length).toBeGreaterThanOrEqual(7);
    expect(
      validateV10ProviderIntegrationBoundaryContracts([
        {
          provider: "supabase",
          owner: "",
          readinessArtifacts: [],
          degradedState: "",
          privacyBoundary: [],
          releaseBlockerKey: "supabase",
          fallbackBehavior: "",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "supabase:owner_required",
        "supabase:readiness_artifact_required",
        "supabase:degraded_state_required",
        "supabase:privacy_boundary_required",
        "supabase:release_blocker_key_required",
        "supabase:fallback_behavior_required",
        "provider_boundary_missing:vercel",
      ])
    );
  });

  it("defines strictness modes for local through post-GA readiness", () => {
    expect(getV10StrictnessMode("local")).toMatchObject({ requireReleaseEvidence: false });
    expect(getV10StrictnessMode("release_candidate")).toMatchObject({
      requireLocalAutomation: true,
      requireReleaseEvidence: true,
      requireExternalDashboard: true,
    });
    expect(getV10StrictnessMode("complete")).toMatchObject({ requireExternalDashboard: true });
    expect(validateV10StrictnessModeGates()).toEqual([]);
    expect(V10_STRICTNESS_MODE_GATES.map((gate) => gate.mode)).toEqual([
      "local",
      "ci",
      "beta",
      "release_candidate",
      "GA",
      "complete",
      "post_ga",
    ]);
    expect(V10_STRICTNESS_MODE_GATES.find((gate) => gate.mode === "release_candidate")).toMatchObject({
      requiredEvidence: expect.arrayContaining(["local_automation", "release_evidence", "external_dashboard"]),
      failurePolicy: "hold_release",
    });
    expect(
      validateV10StrictnessModeGates([
        {
          mode: "release_candidate",
          requiredCommands: [],
          requiredEvidence: ["local_automation"],
          failurePolicy: "block_promotion",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "release_candidate:command_required",
        "release_candidate:release_evidence_required",
        "release_candidate:external_dashboard_required",
        "release_candidate:hold_release_policy_required",
        "strictness_missing:local",
      ])
    );
  });

  it("orders evidence dependencies before release artifacts", () => {
    expect(getV10EvidenceDependencyOrder()).toEqual([
      "fixtures",
      "metrics",
      "performance",
      "accessibility",
      "readiness",
      "release_artifacts",
    ]);
    expect(v10HardeningContractHasRequirement("release_artifacts", "archive_policy")).toBe(true);
  });

  it("covers stable requirement IDs, invariant generation, and adversarial tests", () => {
    expect(V10_REQUIREMENT_ID_CONTRACTS.map((contract) => contract.key)).toContain("ids");
    expect(v10HardeningContractHasRequirement("ids", "never_reused")).toBe(true);
    expect(v10HardeningContractHasRequirement("mutations", "payload_conflict")).toBe(true);
    expect(V10_ADVERSARIAL_TEST_CONTRACTS.map((contract) => contract.key)).toContain("artifacts");
    expect(validateV10AdversarialRouteActionScenarioSet()).toEqual([]);
    expect(V10_ADVERSARIAL_ROUTE_ACTION_SCENARIOS.map((scenario) => scenario.adversary)).toEqual(
      expect.arrayContaining([
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
      ])
    );
    expect(
      validateV10AdversarialRouteActionScenario({
        scenario_id: "leaky_cross_tenant",
        route_or_action: "/api/export/contracts",
        adversary: "cross_tenant",
        expected_status: 403,
        expected_outcome: "forbidden",
        diagnostic_id: "diag",
        audit_required: true,
        idempotency_required: true,
      })
    ).toEqual(expect.arrayContaining(["v10_diagnostic_required", "tenant_isolation_must_not_confirm_existence"]));
  });

  it("covers abuse, privacy lifecycle, scale, concurrency, retention, and focus per surface", () => {
    expect(validateV10AbusePrivacyScaleSurfaces()).toEqual([]);
    expect(V10_ABUSE_PRIVACY_SCALE_SURFACES.map((surface) => surface.surface)).toEqual([
      "home",
      "work",
      "contract_record",
      "review",
      "evidence",
      "reports_exports",
      "settings",
      "command_palette",
    ]);
    expect(V10_ABUSE_PRIVACY_SCALE_SURFACES.find((surface) => surface.surface === "work")).toMatchObject({
      abuseCases: expect.arrayContaining(["bulk_action_payload_conflict", "hidden_assurance_work_leak"]),
      concurrencyCases: expect.arrayContaining(["stale_expected_version", "duplicate_generated_work_repair"]),
      cacheFocusCases: expect.arrayContaining(["active_filter_preserved", "focus_returns_to_completed_row"]),
    });
    expect(V10_ABUSE_PRIVACY_SCALE_SURFACES.find((surface) => surface.surface === "reports_exports")).toMatchObject({
      abuseCases: expect.arrayContaining(["csv_formula_injection", "private_field_export"]),
      scaleBudgets: expect.arrayContaining(["fifty_thousand_row_export"]),
      retentionCases: expect.arrayContaining(["artifact_retention_window"]),
    });
    expect(
      validateV10AbusePrivacyScaleSurfaces([
        {
          surface: "home",
          abuseCases: [],
          privacyLifecycle: ["plain"],
          scaleBudgets: [],
          concurrencyCases: [],
          retentionCases: [],
          cacheFocusCases: ["plain"],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "surface_missing:work",
        "home:abuse_case_required",
        "home:scale_budget_required",
        "home:concurrency_case_required",
        "home:retention_case_required",
        "home:focus_or_cache_preservation_required",
        "home:privacy_lifecycle_state_required",
      ])
    );
  });

  it("covers negative risk plans for auth, privacy, concurrency, stale data, retries, and large results", () => {
    expect(validateV10NegativeRiskTestPlans()).toEqual([]);
    expect(V10_NEGATIVE_RISK_TEST_PLANS.map((plan) => plan.category)).toEqual([
      "authorization",
      "privacy",
      "concurrency",
      "stale_data",
      "retries",
      "large_result",
    ]);
    expect(V10_NEGATIVE_RISK_TEST_PLANS.find((plan) => plan.category === "authorization")).toMatchObject({
      expectedFailureModes: expect.arrayContaining(["not_found", "private_no_store"]),
      supportSafeDiagnosticRequired: true,
    });
    expect(V10_NEGATIVE_RISK_TEST_PLANS.find((plan) => plan.category === "large_result")).toMatchObject({
      expectedFailureModes: expect.arrayContaining(["bounded_limit", "async_handoff", "truncation_metadata"]),
      requiredProof: expect.arrayContaining(["ui", "e2e"]),
    });
    expect(
      validateV10NegativeRiskTestPlans([
        {
          category: "authorization",
          scenarioIds: [],
          expectedFailureModes: ["forbidden"],
          requiredProof: [],
          supportSafeDiagnosticRequired: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "authorization:scenario_required",
        "authorization:proof_required",
        "authorization:support_safe_diagnostic_required",
        "authorization:must_hide_existence",
        "negative_risk_missing:privacy",
      ])
    );
  });

  it("requires quality, security, CI, accessibility, responsive, performance, and release evidence gates", () => {
    expect(validateV10QualitySecurityCiCoverageGates()).toEqual([]);
    expect(V10_QUALITY_SECURITY_CI_COVERAGE_GATES.map((gate) => gate.category)).toEqual([
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
    ]);
    expect(V10_QUALITY_SECURITY_CI_COVERAGE_GATES.find((gate) => gate.category === "release_evidence")).toMatchObject({
      command: "npm run report:runtime-evidence-plan",
      runtimeEvidenceRequired: true,
      blocksPromotion: true,
    });
    expect(V10_QUALITY_SECURITY_CI_COVERAGE_GATES.find((gate) => gate.category === "migration")).toMatchObject({
      command: "npm run check:migration-smoke:current:strict",
      blocksCi: true,
    });
    expect(
      validateV10QualitySecurityCiCoverageGates([
        {
          category: "unit",
          command: "vitest run",
          artifacts: [],
          blocksCi: false,
          blocksPromotion: false,
          runtimeEvidenceRequired: false,
          failureModeCovered: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "unit:npm_command_required",
        "unit:artifact_required",
        "unit:promotion_block_required",
        "unit:failure_mode_required",
        "unit:ci_block_required",
        "quality_gate_missing:api",
      ])
    );
  });

  it("covers persona matrices, reconciliation jobs, and API snapshots", () => {
    expect(V10_PERSONA_WORKSPACE_COVERAGE.map((contract) => contract.key)).toEqual(
      expect.arrayContaining(["personas", "workspace_sizes", "workspace_modes", "plans", "degraded_states"])
    );
    expect(v10HardeningContractHasRequirement("generated_work_integrity", "orphan_source_check")).toBe(true);
    expect(V10_RECONCILIATION_JOB_CONTRACTS.length).toBeGreaterThan(0);
    expect(V10_API_SNAPSHOT_CONTRACTS.map((contract) => contract.key)).toContain("compatibility");
  });

  it("covers database RLS, unique identities, indexes, retention, cleanup, and repair paths", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");

    expect(validateV10DatabaseHardeningContracts()).toEqual([]);
    const rlsTables = Array.from(
      migration.matchAll(/alter table public\.(v10_[a-z0-9_]+) enable row level security/g),
      (match) => match[1]!
    ).sort();
    expect([...V10_DATABASE_HARDENING_CONTRACTS.map((contract) => contract.table)].sort()).toEqual(rlsTables);
    expect(V10_DATABASE_HARDENING_CONTRACTS.map((contract) => contract.table)).toEqual(
      expect.arrayContaining([
        "v10_mutation_idempotency",
        "v10_read_model_rows",
        "v10_work_items",
        "v10_runtime_artifacts",
        "v10_read_model_refresh_jobs",
      ])
    );
    for (const contract of V10_DATABASE_HARDENING_CONTRACTS) {
      expect(migration, `${contract.table}:rls`).toContain(`alter table public.${contract.table} enable row level security`);
      for (const indexName of contract.requiredIndexes) {
        expect(migration, `${contract.table}:${indexName}`).toContain(indexName);
      }
      if (contract.cleanupRoutine) expect(migration, `${contract.table}:cleanup`).toContain(contract.cleanupRoutine);
      if (contract.repairPath && contract.repairPath.startsWith("replace_")) expect(migration, `${contract.table}:repair`).toContain(contract.repairPath);
    }
    expect(
      validateV10DatabaseHardeningContracts([
        {
          table: "runtime_artifacts",
          rlsRequired: false,
          uniqueIdentity: ["artifact_key"],
          requiredIndexes: [],
          retentionRule: "expires_at",
          cleanupRoutine: null,
          repairPath: null,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "runtime_artifacts:v10_table_required",
        "runtime_artifacts:rls_required",
        "runtime_artifacts:org_scoped_unique_identity_required",
        "runtime_artifacts:index_required",
        "runtime_artifacts:expiry_cleanup_required",
        "runtime_artifacts:cleanup_or_repair_required",
        "missing_db_hardening:v10_mutation_idempotency",
      ])
    );
  });

  it("covers notification dedupe and error-budget audit immutability", () => {
    expect(V10_NOTIFICATION_DEDUPE_CONTRACTS.map((contract) => contract.key)).toEqual(
      expect.arrayContaining(["throttling", "dedupe", "resend", "oversend_prevention"])
    );
    expect(v10HardeningContractHasRequirement("audit_immutability", "append_only")).toBe(true);
    expect(v10HardeningContractHasRequirement("tamper_detection", "metric_run_hash")).toBe(true);
    expect(V10_ERROR_BUDGET_AUDIT_CONTRACTS.length).toBe(4);
    expect(V10_HARDENING_CONTRACTS.length).toBeGreaterThan(35);
  });

  it("covers V10 dependency supply chain, deprecation cleanup, and support docs boundaries", () => {
    expect(V10_DEPENDENCY_SUPPLY_CHAIN_CONTRACTS.map((contract) => contract.key)).toEqual(
      expect.arrayContaining(["stack_preservation", "package_scripts", "artifact_integrity", "dependency_changes"])
    );
    expect(V10_DEPRECATION_CLEANUP_CONTRACTS.map((contract) => contract.key)).toContain("v9_v10_overlap");
    expect(V10_SUPPORT_DOC_BOUNDARY_CONTRACTS.map((contract) => contract.key)).toContain("support_runbooks");
    const legacyCurrentProductE2eScript = `test:e2e:v${10}`;
    expect(
      validateV10SupplyChainScripts({
        "check:release-suite-current": "node scripts/check-release-suite-current.mjs",
        "check:release-evidence": "node scripts/check-release-evidence.mjs",
        "check:release-privacy-scan": "node scripts/check-release-evidence.mjs --privacy-scan activation",
        typecheck: "tsc --noEmit",
        lint: "eslint src",
        [legacyCurrentProductE2eScript]: "npm run test:e2e:current-product",
        "test:e2e:current-product": "playwright test --grep @current-product",
        sbom: "cyclonedx-npm",
        "audit:moderate": "npm audit",
      })
    ).toEqual([]);
    expect(validateV10SupplyChainScripts({ lint: "eslint src" })).toEqual(
      expect.arrayContaining(["missing_script:check:release-suite-current", "missing_script:sbom"])
    );
  });

  it("validates deprecation decisions and keeps support docs non-authoritative", () => {
    expect(
      validateV10DeprecationCleanupDecision({
        artifact: SPEC_ARTIFACT_V9_ARCHIVE,
        supersededBy: SPEC_ARTIFACT_V10,
        retirementReason: "V10 release contract supersedes V9 documentation.",
        testsPreserved: true,
        releaseEvidenceKey: "v10_deprecation_policy",
        owner: "release",
      })
    ).toEqual([]);
    expect(validateV10DeprecationCleanupDecision({ artifact: "" })).toEqual(
      expect.arrayContaining([
        "artifact_required",
        "supersession_target_required",
        "retirement_reason_required",
        "tests_preservation_required",
        "release_evidence_key_required",
        "owner_required",
      ])
    );
    expect(
      validateV10SupportDocBoundary({
        docPath: "src/lib/release-contract.ts",
        referencesShippedBehavior: true,
        referencesDiagnostics: true,
        referencesRecoveryPath: true,
        referencesReleaseEvidence: true,
      })
    ).toEqual([]);
    expect(validateV10SupportDocBoundary({ docPath: "support-runbook-draft.md", claimsCompletionProof: true, containsPrivatePayload: true })).toEqual(
      expect.arrayContaining(["shipped_behavior_reference_required", "docs_cannot_claim_completion_proof", "private_payload_forbidden"])
    );
  });

  it("quarantines or retires descriptor, static, environment-gated, and legacy proof paths only after runtime replacement proof", () => {
    expect(validateV10LegacyProofCutoverContracts()).toEqual([]);
    expect(V10_LEGACY_PROOF_CUTOVER_CONTRACTS.map((contract) => contract.proofPath)).toEqual([
      "descriptor_fixture",
      "static_contract",
      "v9_legacy",
      "environment_gate",
    ]);
    expect(V10_LEGACY_PROOF_CUTOVER_CONTRACTS.find((contract) => contract.proofPath === "descriptor_fixture")).toMatchObject({
      cutoverAction: "quarantine",
      replacementCommand: "npm run report:runtime-evidence-plan",
      allowedOnlyAfterRuntimeProof: true,
      testsPreserved: true,
    });
    expect(V10_LEGACY_PROOF_CUTOVER_CONTRACTS.find((contract) => contract.proofPath === "v9_legacy")).toMatchObject({
      cutoverAction: "retire",
      replacementEvidenceKey: "v10-release:promotion-decision:complete",
    });
    expect(
      validateV10LegacyProofCutoverContracts([
        {
          legacyArtifact: "static descriptor",
          proofPath: "static_contract",
          cutoverAction: "retire",
          replacementEvidenceKey: "v10-release:bad",
          replacementCommand: "node check.js",
          allowedOnlyAfterRuntimeProof: false,
          testsPreserved: false,
          rollbackArtifact: "",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "static descriptor:replacement_command_required",
        "static descriptor:runtime_proof_gate_required",
        "static descriptor:tests_preservation_required",
        "static descriptor:rollback_artifact_required",
        "static descriptor:retire_requires_legacy_path",
        "legacy_cutover_missing:descriptor_fixture",
      ])
    );
  });

  it("validates the actual package scripts required by V10 supply-chain gates", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(validateV10SupplyChainScripts(packageJson.scripts)).toEqual([]);
  });

  it("codifies final QA and failure-injection evidence requirements", () => {
    const evidenceRequestRouteTest = readFileSync(join(process.cwd(), "src/app/api/evidence/requests/route.test.ts"), "utf8");
    const readModelRefreshCronTest = readFileSync(join(process.cwd(), "src/app/api/cron/v10/read-model-refresh/route.test.ts"), "utf8");

    expect(V10_SCRIPTED_QA_CONTRACTS.map((contract) => contract.key)).toEqual([
      "final_qa_sampling",
      "failure_injection",
      "negative_case_sampling",
    ]);
    expect(evidenceRequestRouteTest).toContain("surfaces stale expected-version failures");
    expect(readModelRefreshCronTest).toContain("surfaces partial refresh diagnostics");
    expect(
      validateV10ScriptedQaScenario({
        scenario_id: "stale-read-model-home",
        fixture_id: "degraded-jobs",
        route_or_action: "/dashboard",
        expected_state: "stale_read_model",
        observed_state: "stale_read_model",
        diagnostic_id: "diag_stale_read_model",
        audit_event_id: null,
        telemetry_or_evidence_key: "v10_failure_injection_stale_read_model",
        artifact_ref: "playwright:v10-core-smoke",
        blocker: null,
      })
    ).toEqual([]);
    expect(
      validateV10ScriptedQaScenario({
        scenario_id: "",
        fixture_id: "",
        route_or_action: "",
        expected_state: "failed_retryable",
        observed_state: "succeeded",
        diagnostic_id: null,
        audit_event_id: null,
        telemetry_or_evidence_key: null,
        artifact_ref: null,
        blocker: null,
        state_changing: true,
      })
    ).toEqual(
      expect.arrayContaining([
        "scenario_id_required",
        "fixture_id_required",
        "route_or_action_required",
        "artifact_ref_required",
        "telemetry_or_evidence_key_required",
        "diagnostic_id_required_for_failure_state",
        "audit_event_required_for_state_change",
        "blocker_required_for_state_mismatch",
      ])
    );
  });
});
