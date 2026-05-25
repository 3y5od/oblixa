import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V10_MUTATION_CATALOG } from "./release-contract";
import { V10_EXPECTED_VERSION_EXEMPT_MUTATIONS, V10_REQUIRED_MUTATION_CONTRACTS, validateV10RequiredMutationContracts } from "./mutation-envelope";
import {
  canonicalizeV10MutationName,
  V10_MIGRATION_ROLLOUT_SAFETY_CONTRACTS,
  V10_MIGRATION_SAFETY_CHECKS,
  V10_MUTATION_ROLLOUT_CONTRACTS,
  V10_MUTATION_RUNTIME_ALIASES,
  V10_RUNTIME_ARTIFACT_OPS_PLANS,
  V10_WORKSPACE_DOWNGRADE_PLANS,
  buildV10BackfillRunbookManifest,
  evaluateV10RolloutDecision,
  getV10MutationAuthorizationOutcome,
  getV10MutationCatalogEntry,
  getV10MutationRolloutContract,
  validateV10RollbackReadiness,
  validateV10RuntimeArtifactOpsPlan,
  validateV10RuntimeArtifactOpsPlans,
  validateV10MigrationRolloutSafetyContracts,
  validateV10MigrationSafetyChecks,
  v10MutationRequiresTransactionalAudit,
  validateV10WorkspaceDowngradePlans,
} from "./mutation-rollout";

describe("V10 mutation rollout contracts", () => {
  it("adds adapter contracts for every mutation catalog row", () => {
    expect(V10_MUTATION_ROLLOUT_CONTRACTS).toHaveLength(V10_MUTATION_CATALOG.length);
    expect(V10_MUTATION_ROLLOUT_CONTRACTS.map((contract) => contract.mutationName)).toEqual(
      V10_MUTATION_CATALOG.map((mutation) => mutation.name)
    );
    for (const contract of V10_MUTATION_ROLLOUT_CONTRACTS) {
      expect(contract.legacyCompatible).toBe(true);
      expect(contract.idempotencyRequired).toBe(true);
      expect(contract.auditRequired).toBe(true);
      expect(contract.actorMustBeServerDerived).toBe(true);
    }
  });

  it("keeps each mutation audit-backed and discoverable", () => {
    const mutation = getV10MutationCatalogEntry("update_workspace_mode");
    expect(mutation.auditAction).toBe("workspace.mode_updated");
    expect(getV10MutationRolloutContract("update_workspace_mode").expectedVersionRequired).toBe(true);
    expect(getV10MutationRolloutContract("submit_external_evidence").expectedVersionRequired).toBe(false);
    expect(v10MutationRequiresTransactionalAudit("reject_evidence")).toBe(true);
  });

  it("keeps required mutation envelopes aligned with rollout idempotency and expected-version policy", () => {
    expect(validateV10RequiredMutationContracts()).toEqual([]);
    expect(V10_EXPECTED_VERSION_EXEMPT_MUTATIONS).toEqual(["submit_external_evidence", "create_export_job"]);
    for (const contract of V10_REQUIRED_MUTATION_CONTRACTS) {
      const rollout = getV10MutationRolloutContract(contract.key as Parameters<typeof getV10MutationRolloutContract>[0]);
      expect(contract.requiresIdempotency, contract.key).toBe(rollout.idempotencyRequired);
      expect(contract.requiresAudit, contract.key).toBe(rollout.auditRequired);
      expect(contract.requiresExpectedVersion, contract.key).toBe(rollout.expectedVersionRequired);
      expect(existsSync(join(process.cwd(), contract.runtimeArtifact)), contract.key).toBe(true);
    }
    expect(V10_REQUIRED_MUTATION_CONTRACTS.find((contract) => contract.key === "create_report_run")).toMatchObject({
      targetType: "report_run",
      requiresExpectedVersion: true,
    });
    expect(V10_REQUIRED_MUTATION_CONTRACTS.find((contract) => contract.key === "create_export_job")).toMatchObject({
      targetType: "export_job",
      requiresExpectedVersion: false,
    });
  });

  it("canonicalizes runtime route and server-action mutation aliases", () => {
    expect(V10_MUTATION_RUNTIME_ALIASES["approval.request_changes"]).toBe("request_approval_changes");
    expect(canonicalizeV10MutationName("approval.approve")).toBe("approve_approval_request");
    expect(canonicalizeV10MutationName("approval.request-changes")).toBe("request_approval_changes");
    expect(canonicalizeV10MutationName("approval.delegate")).toBe("delegate_approval_request");
    expect(canonicalizeV10MutationName("exception.assign")).toBe("assign_exception_owner");
    expect(canonicalizeV10MutationName("renewal.generate_decision_packet")).toBe("generate_renewal_decision_packet");
    expect(canonicalizeV10MutationName("bulkCompleteCompatibleContractTasks")).toBe("bulk_complete_compatible_work_items");
    expect(getV10MutationRolloutContract("report_pack.create").mutationName).toBe("create_report_run");
    expect(v10MutationRequiresTransactionalAudit("evidence.submit")).toBe(true);
    expect(canonicalizeV10MutationName("unknown.runtime.mutation")).toBeNull();
  });

  it("maps auth, org, plan, mode, hidden module, and role failures to V10 outcomes", () => {
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "create_report_run",
        actorRole: "viewer",
        authenticated: false,
        sameOrganization: true,
      })
    ).toBe("unauthorized");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "create_report_run",
        actorRole: "viewer",
        authenticated: true,
        sameOrganization: false,
      })
    ).toBe("not_found");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "update_module_visibility",
        actorRole: "viewer",
        authenticated: true,
        sameOrganization: true,
      })
    ).toBe("forbidden");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "create_export_job",
        actorRole: "viewer",
        authenticated: true,
        sameOrganization: true,
        planAllowed: false,
      })
    ).toBe("plan_required");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "create_export_job",
        actorRole: "viewer",
        authenticated: true,
        sameOrganization: true,
        moduleHidden: true,
      })
    ).toBe("hidden_module");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "create_export_job",
        actorRole: "viewer",
        authenticated: true,
        sameOrganization: true,
        modeAllowed: false,
      })
    ).toBe("mode_required");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "create_export_job",
        actorRole: "viewer",
        authenticated: true,
        sameOrganization: true,
        archivedOrDeleted: true,
        moduleHidden: true,
      })
    ).toBe("not_found");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "submit_external_evidence",
        actorRole: "external_token",
        authenticated: false,
        sameOrganization: true,
      })
    ).toBe("success");
    expect(
      getV10MutationAuthorizationOutcome({
        mutationName: "update_workspace_mode",
        actorRole: "admin",
        authenticated: true,
        sameOrganization: true,
      })
    ).toBe("success");
  });

  it("enforces rollout states, canaries, fixture-only gates, and kill switches", () => {
    expect(evaluateV10RolloutDecision({ rolloutState: "disabled" })).toMatchObject({
      allowed: false,
      reason: "rollout_disabled",
    });
    expect(evaluateV10RolloutDecision({ rolloutState: "internal_only", actorInternal: false })).toMatchObject({
      outcome: "forbidden",
      reason: "internal_only",
    });
    expect(evaluateV10RolloutDecision({ rolloutState: "fixture_only", fixtureWorkspace: true }).allowed).toBe(true);
    expect(
      evaluateV10RolloutDecision({
        rolloutState: "beta_canary",
        canaryPercent: 10,
        workspaceBucket: 42,
      })
    ).toMatchObject({ allowed: false, reason: "outside_canary" });
    expect(evaluateV10RolloutDecision({ rolloutState: "ga", killSwitchActive: true })).toMatchObject({
      allowed: false,
      reason: "kill_switch_active",
      recoveryDestination: "/settings/health",
    });
  });

  it("requires rollback, backfill, rebuild, archive, and owner proof before GA rollout", () => {
    expect(existsSync(join(process.cwd(), "scripts/rebuild-read-models.mjs"))).toBe(true);
    expect(
      validateV10RollbackReadiness({
        rollbackState: "ga_candidate",
        rollbackRunbook: "scripts/rebuild-read-models.mjs",
        backfillVerified: true,
        readModelRebuildVerified: true,
        evidenceArchiveVerified: true,
        owner: "release",
      })
    ).toEqual([]);
    expect(
      validateV10RollbackReadiness({
        rollbackState: "ga",
        rollbackRunbook: null,
        backfillVerified: false,
        readModelRebuildVerified: false,
        evidenceArchiveVerified: false,
        owner: null,
      })
    ).toEqual(
      expect.arrayContaining([
        "rollback_owner_required",
        "rollback_runbook_required",
        "backfill_verification_required",
        "read_model_rebuild_required",
        "evidence_archive_required",
        "ga_rollout_requires_complete_rollback_readiness",
      ])
    );
  });

  it("defines rollout, repair, retention, and disaster recovery plans for runtime artifacts", () => {
    expect(validateV10RuntimeArtifactOpsPlans()).toEqual([]);
    expect(V10_RUNTIME_ARTIFACT_OPS_PLANS.map((plan) => plan.artifactKind)).toEqual(
      expect.arrayContaining([
        "read_models",
        "command_search_index",
        "audit_events",
        "release_evidence",
        "report_export_artifacts",
        "idempotency_rows",
        "external_links",
      ])
    );
    expect(V10_RUNTIME_ARTIFACT_OPS_PLANS.find((plan) => plan.artifactKind === "read_models")).toMatchObject({
      backfillMode: "source_targeted_repair",
      phases: expect.arrayContaining(["preflight", "dry_run", "incremental_backfill", "verify", "rollback", "post_run_report"]),
      disasterRecoveryActions: expect.arrayContaining(["rebuild_from_source_tables", "regenerate_command_search_index"]),
    });
    expect(V10_RUNTIME_ARTIFACT_OPS_PLANS.find((plan) => plan.artifactKind === "external_links")?.rollbackSteps).toEqual(
      expect.arrayContaining(["revoke_new_links"])
    );
  });

  it("builds a concrete backfill, verification, and rollback manifest for release operations", () => {
    const manifest = buildV10BackfillRunbookManifest({
      rolloutState: "ga_candidate",
      generatedAt: "2026-04-26T16:15:00Z",
    });

    expect(manifest.generatedAt).toBe("2026-04-26T16:15:00Z");
    expect(manifest.preflightCommands).toEqual(
      expect.arrayContaining(["npm run check:release-evidence", "npm run check:release-suite-current", "npm run typecheck"])
    );
    expect(manifest.backfillCommands).toEqual(
      expect.arrayContaining([
        "refresh_v10_runtime_artifact --artifact=read_models --mode=source_targeted_repair --dry-run-first",
        "refresh_v10_runtime_artifact --artifact=release_evidence --mode=incremental --dry-run-first",
      ])
    );
    expect(manifest.verificationCommands.some((command) => command.includes("--artifact=command_search_index"))).toBe(true);
    expect(manifest.rollbackCommands).toEqual(
      expect.arrayContaining([
        "rollback_v10_runtime_artifact --artifact=external_links --step=revoke_new_links",
        "rollback_v10_runtime_artifact --artifact=release_evidence --step=mark_candidate_evidence_stale",
      ])
    );
    expect(manifest.requiredOwners).toEqual(expect.arrayContaining(["engineering", "security", "release", "operations"]));
    expect(manifest.artifactKinds).toEqual(V10_RUNTIME_ARTIFACT_OPS_PLANS.map((plan) => plan.artifactKind));
  });

  it("defines downgrade, migration safety, and repair checks for existing workspaces", () => {
    expect(validateV10WorkspaceDowngradePlans()).toEqual([]);
    expect(V10_WORKSPACE_DOWNGRADE_PLANS.map((plan) => plan.transition)).toEqual([
      "advanced_to_core",
      "assurance_to_advanced",
      "assurance_to_core",
      "plan_past_due",
    ]);
    expect(V10_WORKSPACE_DOWNGRADE_PLANS.find((plan) => plan.transition === "plan_past_due")).toMatchObject({
      hideIneligibleRows: true,
      purgeRecentCommandLeakage: true,
      suppressNotifications: true,
      recoveryDestination: "/settings/billing",
    });

    expect(validateV10MigrationSafetyChecks()).toEqual([]);
    expect(V10_MIGRATION_SAFETY_CHECKS.find((check) => check.checkKey === "057_v10_runtime_contracts_forward_only")).toMatchObject({
      forwardOnly: true,
      idempotentDdl: true,
      rlsVerified: true,
      indexesVerified: true,
      rollbackPath: "scripts/rebuild-read-models.mjs --dry-run",
    });
    expect(validateV10MigrationRolloutSafetyContracts()).toEqual([]);
    expect(V10_MIGRATION_ROLLOUT_SAFETY_CONTRACTS.map((contract) => contract.phase)).toEqual([
      "additive_migration",
      "idempotent_backfill",
      "validation_gate",
      "rollout_gate",
      "canary",
      "rollback",
      "cleanup",
    ]);
    expect(V10_MIGRATION_ROLLOUT_SAFETY_CONTRACTS.find((contract) => contract.phase === "canary")).toMatchObject({
      checks: expect.arrayContaining(["read_model_refresh_success", "mutation_replay_correctness", "audit_write_success"]),
      rollbackPath: "pause_rollout_and_rebuild_affected_runtime_artifacts",
    });
    expect(
      validateV10MigrationRolloutSafetyContracts([
        {
          key: "schema_additive_first_use",
          phase: "additive_migration",
          protectedArtifacts: [],
          checks: ["forward_only"],
          rollbackPath: null,
          compatibilityBoundary: null,
          cleanupCheckpoint: null,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "migration_rollout_phase_missing:idempotent_backfill",
        "schema_additive_first_use:protected_artifact_required",
        "schema_additive_first_use:rollback_path_required",
        "schema_additive_first_use:compatibility_boundary_required",
        "schema_additive_first_use:idempotent_ddl_check_required",
      ])
    );
    expect(
      validateV10WorkspaceDowngradePlans([
        {
          transition: "advanced_to_core",
          hideIneligibleRows: false,
          purgeRecentCommandLeakage: false,
          preserveAuditVisibility: false,
          suppressNotifications: false,
          readModelRepairRequired: false,
          recoveryDestination: "/work",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "advanced_to_core:hide_ineligible_rows_required",
        "advanced_to_core:command_leakage_purge_required",
        "advanced_to_core:audit_visibility_required",
        "advanced_to_core:notification_suppression_required",
        "advanced_to_core:read_model_repair_required",
        "advanced_to_core:settings_recovery_destination_required",
        "downgrade_plan_missing:assurance_to_advanced",
      ])
    );
  });

  it("rejects incomplete runtime artifact operation plans", () => {
    expect(
      validateV10RuntimeArtifactOpsPlan({
        artifactKind: "external_links",
        owner: "",
        phases: ["preflight"],
        backfillMode: "incremental",
        repairTargets: [],
        rollbackSteps: ["preserve_audit_only"],
        retentionDays: 0,
        diagnostics: ["plain"],
        disasterRecoveryActions: [],
      })
    ).toEqual(
      expect.arrayContaining([
        "owner_required",
        "phase_required:verify",
        "phase_required:rollback",
        "phase_required:post_run_report",
        "backfill_requires_dry_run_or_incremental_phase",
        "repair_target_required",
        "retention_days_required",
        "support_safe_diagnostic_required",
        "disaster_recovery_action_required",
        "external_links_require_revocation_rollback",
      ])
    );
  });
});
