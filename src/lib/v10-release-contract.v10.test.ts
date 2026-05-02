import { describe, expect, it } from "vitest";
import {
  V10_ACCEPTANCE_GATES,
  V10_ACCEPTANCE_GATE_RELEASE_SCOPE,
  V10_ACTIVATION_STATES,
  V10_CONTRACT_NEXT_ACTION_ORDER,
  V10_CORE_REPORT_FAMILIES,
  V10_GA_SAMPLE_SIZES,
  V10_HEALTH_DEDUCTIONS,
  V10_JOB_CLASSES,
  V10_JOB_STATUSES,
  V10_MUTATION_CATALOG,
  V10_MUTATION_OUTCOMES,
  V10_NAVIGATION_FAMILIES,
  V10_NON_GOALS,
  V10_NOTIFICATION_CLASSES,
  V10_OBJECTIVE_TARGETS,
  V10_READ_MODEL_FIELDS,
  V10_RELEASE_CONTRACT_BEHAVIORS,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_RELEASE_PRIORITY_TIERS,
  V10_RELEASE_STATES,
  V10_REQUIRED_ACTIVATION_FIELDS,
  V10_SHARED_READ_MODEL_FIELDS,
  V10_SOURCE_OBJECT_TYPES,
  V10_SPEC_VERSION,
  V10_VERSIONED_ARTIFACT_CONTRACTS,
  V10_WORK_ITEM_TYPES,
  V10_WORK_LENSES,
  V10_WORKSPACE_MODES,
  getV10VersionedArtifactContract,
  validateV10VersionedArtifactContract,
} from "./v10-release-contract";

describe("V10 release contract constants", () => {
  it("codifies the release scope without adding a new navigation family", () => {
    expect(V10_SPEC_VERSION).toBe("v10.0.0");
    expect(V10_RELEASE_CONTRACT_BEHAVIORS).toContain("job recovery");
    expect(V10_NAVIGATION_FAMILIES).toEqual([
      "Home",
      "Contracts",
      "Review",
      "Work",
      "Renewals",
      "Exceptions",
      "Evidence",
      "Reports",
      "Settings",
      "Advanced",
      "Assurance",
    ]);
    expect(V10_NON_GOALS).toContain("new top-level navigation area");
  });

  it("keeps section 5 shared enums and V10 state vocabularies explicit", () => {
    expect(V10_WORK_ITEM_TYPES).toHaveLength(13);
    expect(V10_WORK_ITEM_TYPES).toContain("automation_approval");
    expect(V10_MUTATION_OUTCOMES).toContain("audit_write_failed");
    expect(V10_WORKSPACE_MODES).toEqual(["core", "advanced", "assurance"]);
    expect(V10_JOB_STATUSES).toEqual([
      "queued",
      "running",
      "succeeded",
      "partial",
      "failed_retryable",
      "failed_terminal",
      "retrying",
      "canceled",
    ]);
    for (const values of [
      V10_WORK_ITEM_TYPES,
      V10_MUTATION_OUTCOMES,
      V10_JOB_STATUSES,
      V10_JOB_CLASSES,
      V10_NOTIFICATION_CLASSES,
      V10_SOURCE_OBJECT_TYPES,
      V10_CORE_REPORT_FAMILIES,
    ]) {
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("captures primary experience catalogs", () => {
    expect(V10_ACTIVATION_STATES[0]).toBe("workspace_prepared");
    expect(V10_ACTIVATION_STATES.at(-1)).toBe("dashboard_updated");
    expect(V10_REQUIRED_ACTIVATION_FIELDS).toContain("notice_deadline");
    expect(V10_WORK_LENSES).toContain("failed_jobs");
    expect(V10_CONTRACT_NEXT_ACTION_ORDER[0]).toBe("failed_import_or_extraction_blocking_record_creation");
    expect(V10_HEALTH_DEDUCTIONS.map((row) => row.points)).toContain(20);
  });

  it("captures reports, jobs, notifications, mutations, and acceptance gates", () => {
    expect(V10_CORE_REPORT_FAMILIES).toHaveLength(10);
    expect(V10_JOB_CLASSES).toContain("billing_sync");
    expect(V10_NOTIFICATION_CLASSES).toContain("automation_approval_required");
    expect(V10_MUTATION_CATALOG.length).toBeGreaterThanOrEqual(23);
    expect(V10_MUTATION_CATALOG.map((mutation) => mutation.name)).toEqual(
      expect.arrayContaining(["create_contract_import", "delegate_approval_request", "generate_renewal_decision_packet"])
    );
    expect(V10_ACCEPTANCE_GATES).toHaveLength(16);
  });

  it("makes release priority tiers and gate scope machine-checkable", () => {
    expect(V10_RELEASE_PRIORITY_TIERS.P0).toEqual(
      expect.arrayContaining([
        "activation_state_machine",
        "unified_work_lenses_and_actions",
        "data_api_contracts",
      ])
    );
    expect(V10_RELEASE_PRIORITY_TIERS.P1).toContain("counterparty_account_relationship_summaries");
    expect(V10_RELEASE_PRIORITY_TIERS.P2).toContain("additional_automation_playbooks");
    expect(V10_ACCEPTANCE_GATE_RELEASE_SCOPE.map((row) => row.gate)).toEqual(V10_ACCEPTANCE_GATES);
    expect(V10_ACCEPTANCE_GATE_RELEASE_SCOPE.every((row) => row.beta && row.ga && row.complete)).toBe(true);
  });

  it("tracks release fixtures and objective sample sizes", () => {
    expect(V10_RELEASE_FIXTURE_MINIMUMS.core_workspaces).toBe(5);
    expect(V10_RELEASE_FIXTURE_MINIMUMS.contracts).toBe(50);
    expect(V10_GA_SAMPLE_SIZES.command_palette_search).toBe(200);
    expect(V10_RELEASE_STATES.map((row) => row.state)).toEqual(["beta", "GA", "complete"]);
    expect(V10_OBJECTIVE_TARGETS.map((objective) => objective.measurementKey)).toEqual(
      expect.arrayContaining(["activation", "work_reachability", "usability_participants"])
    );
  });

  it("lists source objects and read-model fields for cross-surface contracts", () => {
    expect(V10_SOURCE_OBJECT_TYPES).toContain("workspace_health_diagnostic");
    expect(V10_READ_MODEL_FIELDS.work_items).toContain("compatible_action_group");
    expect(V10_READ_MODEL_FIELDS.command_search_index).toContain("rank_terms_safe");
    expect(V10_READ_MODEL_FIELDS.report_run_visibility).toContain("generated_row_count");
    for (const [modelKey, fields] of Object.entries(V10_READ_MODEL_FIELDS)) {
      expect(new Set(fields).size, modelKey).toBe(fields.length);
      expect([...V10_SHARED_READ_MODEL_FIELDS, ...fields], modelKey).toEqual(
        expect.arrayContaining(["organization_id", "source_table", "source_id", "visibility_state"])
      );
    }
    expect(V10_MUTATION_CATALOG.map((mutation) => mutation.name)).toEqual([...new Set(V10_MUTATION_CATALOG.map((mutation) => mutation.name))]);
    for (const mutation of V10_MUTATION_CATALOG) {
      expect(mutation.auditAction).toMatch(/^[a-z0-9_]+\.[a-z0-9_]+$/);
      expect(mutation.minimumRole.length).toBeGreaterThan(0);
    }
  });

  it("codifies versioning compatibility for schema, read models, APIs, telemetry, evidence, fixtures, and acceptance matrices", () => {
    expect(V10_VERSIONED_ARTIFACT_CONTRACTS.map((contract) => contract.kind)).toEqual([
      "schema",
      "read_model",
      "api",
      "mutation",
      "telemetry",
      "release_evidence",
      "fixture",
      "acceptance_matrix",
    ]);
    for (const contract of V10_VERSIONED_ARTIFACT_CONTRACTS) {
      expect(validateV10VersionedArtifactContract(contract), contract.kind).toEqual([]);
    }
    expect(getV10VersionedArtifactContract("schema")).toMatchObject({
      compatibilityPolicy: "breaking_requires_major",
      migrationOrEvidenceRequired: true,
    });
    expect(
      validateV10VersionedArtifactContract({
        kind: "fixture",
        version: "v11.0.0",
        compatibilityPolicy: "additive_only",
        traceabilityRequired: false,
        migrationOrEvidenceRequired: false,
      })
    ).toEqual([
      "version_must_be_v10_semver",
      "traceability_required",
      "migration_or_evidence_required",
      "evidence_version_lock_required",
    ]);
  });
});
