import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V10_JOB_CLASSES,
  V10_SOURCE_OBJECT_TYPES,
  V10_WORK_ACTIONS,
  V10_WORK_ITEM_TYPES,
} from "./release-contract";
import {
  V10_AUDIT_VOCABULARY_TAXONOMY,
  V10_ATTACHED_PLAN_TODO_IDS,
  V10_COMMAND_QUERY_SAMPLE_SET,
  V10_COMPATIBILITY_BOUNDARIES,
  V10_DEPRECATION_CANDIDATES,
  V10_DEPRECATION_CLEANUP_DECISIONS,
  V10_FILE_OWNERSHIP_MAP,
  V10_FROZEN_IMPLEMENTATION_MATRIX,
  V10_JOB_CLASS_MATRIX,
  V10_MASTER_PLAN_TODO_IDS,
  V10_REQUIRED_COMPATIBILITY_BOUNDARIES,
  V10_REQUIRED_FILE_OWNERSHIP_AREAS,
  V10_REQUIRED_PROOF_DIMENSIONS,
  V10_REQUIRED_SOURCE_INVENTORY_CATEGORIES,
  V10_SOURCE_INVENTORY,
  V10_WORK_SOURCE_ACTION_MATRIX,
  buildV10NoExclusionsVerificationMatrix,
  buildV10ClaimVsProofRows,
  getV10PlanTodoProof,
  validateV10FinalGapAudit,
  validateV10FinalGapRatchet,
  validateV10NoExclusionsVerificationMatrix,
  validateV10DeprecationCleanupDecisions,
  validateV10Phase0InventoryLock,
  validateV10SourceInventory,
} from "./final-gap-audit";

describe("V10 final gap audit", () => {
  it("closes the repeatable final gap audit with no missing matrix rows", () => {
    expect(validateV10FinalGapAudit()).toEqual([]);
  });

  it("maps every work type to a source object, action, audit verb, and refresh artifact", () => {
    expect(V10_WORK_SOURCE_ACTION_MATRIX.map((row) => row.workItemType).sort()).toEqual([...V10_WORK_ITEM_TYPES].sort());
    for (const row of V10_WORK_SOURCE_ACTION_MATRIX) {
      expect(V10_SOURCE_OBJECT_TYPES).toContain(row.sourceObjectType);
      expect(V10_WORK_ACTIONS).toContain(row.primaryAction);
      expect(row.auditAction).toContain(".");
      expect(existsSync(join(process.cwd(), row.refreshArtifact)), row.workItemType).toBe(true);
    }
  });

  it("maps every job class to visibility, retry, terminal, and diagnostic contracts", () => {
    expect(V10_JOB_CLASS_MATRIX.map((row) => row.jobClass).sort()).toEqual([...V10_JOB_CLASSES].sort());
    for (const row of V10_JOB_CLASS_MATRIX) {
      expect(row.sourceTable.length, row.jobClass).toBeGreaterThan(3);
      expect(row.retryableStatuses).toEqual(expect.arrayContaining(["failed_retryable", "partial"]));
      expect(row.terminalStatuses).toEqual(expect.arrayContaining(["succeeded", "failed_terminal", "canceled"]));
      expect(row.diagnosticPrefix).toMatch(/^[a-z_]+$/);
    }
  });

  it("encodes the 200-query command palette sample mix and recovery expectations", () => {
    expect(V10_COMMAND_QUERY_SAMPLE_SET).toHaveLength(200);
    expect(new Set(V10_COMMAND_QUERY_SAMPLE_SET.map((row) => row.id)).size).toBe(200);
    expect(V10_COMMAND_QUERY_SAMPLE_SET.map((row) => row.expectedBehavior)).toEqual(
      expect.arrayContaining(["exact_or_prefix_match", "alias_match", "recovery_zero_result", "hidden_record_non_leakage"])
    );
    expect(V10_COMMAND_QUERY_SAMPLE_SET.map((row) => row.expectedRecordType)).toEqual(
      expect.arrayContaining([
        "contract",
        "work_item",
        "obligation",
        "approval",
        "evidence_request",
        "report_run",
        "saved_view",
        "setting",
        "exception",
        "renewal_checkpoint",
        "import_job",
        "export_job",
        "account",
        "counterparty",
        "finding",
      ])
    );
    for (const row of V10_COMMAND_QUERY_SAMPLE_SET) {
      expect(existsSync(join(process.cwd(), row.proofArtifact)), row.id).toBe(true);
      expect(row.query.length, row.id).toBeGreaterThan(2);
    }
  });

  it("normalizes audit vocabulary to support-safe target and metadata contracts", () => {
    expect(V10_AUDIT_VOCABULARY_TAXONOMY.length).toBeGreaterThanOrEqual(8);
    for (const row of V10_AUDIT_VOCABULARY_TAXONOMY) {
      expect(row.action).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(V10_SOURCE_OBJECT_TYPES).toContain(row.targetType);
      expect(row.outcomeRequired).toBe(true);
      expect(row.safeMetadataOnly).toBe(true);
    }
  });

  it("keeps broad plan todos tied to concrete proof artifacts or explicit blockers", () => {
    for (const id of [
      "read-model-refresh",
      "core-surfaces",
      "mutation-audit-idempotency",
      "search-report-job-notification",
      "governance-security-privacy",
      "release-evidence-blockers",
      "command-query-sample-set",
      "work-source-action-matrix",
      "job-class-matrix",
      "final-gap-audit-mechanics",
      "exhaustive-artifact-sweep",
      "non-autonomous-proof",
      "phase-0-inventory-lock",
      "phase-0-baseline",
      "phase-1-read-models",
      "phase-2-security",
      "phase-3-mutations",
      "phase-4-core-surfaces",
      "phase-5-domain-workflows",
      "phase-6-routing-reporting",
      "phase-7-ops-governance",
      "phase-8-p1-p2",
      "phase-9-ui-quality",
      "phase-10-release",
      "phase-11-post-ga-drift",
      "phase-12-api-env-integrations",
      "phase-13-data-lifecycle-compliance",
      "phase-14-verification-matrix",
      ...V10_ATTACHED_PLAN_TODO_IDS,
    ]) {
      const proof = getV10PlanTodoProof(id);
      expect(proof, id).not.toBeNull();
      expect(proof?.artifacts.length, id).toBeGreaterThan(0);
      for (const artifact of proof?.artifacts ?? []) {
        expect(existsSync(join(process.cwd(), artifact)), `${id}:${artifact}`).toBe(true);
      }
      if (proof?.proofKind === "environment_gated" || proof?.proofKind === "non_autonomous_blocker" || proof?.proofKind === "release_evidence") {
        expect(proof.blocker, id).toBeTruthy();
      }
    }
  });

  it("inventories source artifacts across runtime, data, telemetry, jobs, notifications, and release evidence", () => {
    expect(validateV10SourceInventory()).toEqual([]);
    expect(V10_SOURCE_INVENTORY.map((entry) => entry.category)).toEqual(expect.arrayContaining([...V10_REQUIRED_SOURCE_INVENTORY_CATEGORIES]));
    for (const entry of V10_SOURCE_INVENTORY.filter((row) => row.runtimeStatus !== "external_blocker")) {
      expect(existsSync(join(process.cwd(), entry.artifact)), `${entry.category}:${entry.key}`).toBe(true);
    }
    expect(V10_SOURCE_INVENTORY.find((entry) => entry.key === "release_evidence")).toMatchObject({
      runtimeStatus: "external_blocker",
      testStatus: "release_check",
    });
    expect(
      V10_SOURCE_INVENTORY.filter((entry) => entry.category === "report_family" || entry.category === "notification_class").map(
        (entry) => entry.runtimeStatus
      )
    ).not.toContain("contract_only");
  });

  it("ratchets final gaps so placeholders, contract-only rows, and skipped proof cannot promote", () => {
    expect(validateV10FinalGapRatchet()).toEqual([]);
    expect(
      validateV10FinalGapRatchet({
        inventory: [
          {
            category: "api_route",
            key: "placeholder_route",
            artifact: "src/app/api/placeholder/route.ts",
            owner: "engineering",
            runtimeStatus: "contract_only",
            testStatus: "api",
          },
        ],
        sourceTexts: [
          { artifact: "src/lib/example.ts", text: "export function run() { throw new Error('not implemented'); }" },
          { artifact: "src/lib/example.test.ts", text: "it.skip('covers runtime proof', () => {});" },
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        "api_route:placeholder_route:runtime_implementation_required",
        "src/lib/example.ts:placeholder_text_blocked",
        "src/lib/example.test.ts:skipped_test_blocked",
      ])
    );
  });

  it("freezes the master plan todo ids into an executable Phase 0 implementation matrix", () => {
    expect(validateV10Phase0InventoryLock()).toEqual([]);
    expect(V10_FROZEN_IMPLEMENTATION_MATRIX.map((row) => row.todoId).sort()).toEqual(
      [...V10_MASTER_PLAN_TODO_IDS].sort()
    );
    expect(V10_MASTER_PLAN_TODO_IDS).toEqual(
      expect.arrayContaining([
        "phase-0-inventory-lock",
        "phase-0-baseline",
        "phase-1-read-models",
        "phase-10-release",
        "phase-14-verification-matrix",
      ])
    );
    const requiredDimensions = new Set(V10_FROZEN_IMPLEMENTATION_MATRIX.flatMap((row) => row.requiredDimensions));
    for (const dimension of V10_REQUIRED_PROOF_DIMENSIONS) {
      expect(requiredDimensions.has(dimension), dimension).toBe(true);
    }
    for (const row of V10_FROZEN_IMPLEMENTATION_MATRIX) {
      expect(row.requiredDimensions.length, row.todoId).toBeGreaterThan(0);
      expect(row.primaryArtifacts.length, row.todoId).toBeGreaterThan(0);
      expect(row.acceptanceIds.length, row.todoId).toBeGreaterThan(0);
    }
  });

  it("keeps every attached plan todo tied to proof artifacts and explicit blocker policy", () => {
    for (const id of V10_ATTACHED_PLAN_TODO_IDS) {
      const proof = getV10PlanTodoProof(id);
      expect(proof, id).not.toBeNull();
      expect(proof?.artifacts.length, id).toBeGreaterThan(0);
      for (const artifact of proof?.artifacts ?? []) {
        expect(existsSync(join(process.cwd(), artifact)), `${id}:${artifact}`).toBe(true);
      }
      if (proof?.proofKind === "release_evidence" || proof?.proofKind === "environment_gated") {
        expect(proof.blocker, id).toBeTruthy();
      } else {
        expect(proof?.blocker, id).toBeNull();
      }
    }
  });

  it("builds the final no-exclusions matrix across requirements, files, source objects, routes, mutations, events, and gates", () => {
    const matrix = buildV10NoExclusionsVerificationMatrix();
    expect(validateV10NoExclusionsVerificationMatrix(matrix)).toEqual([]);
    expect(matrix.map((row) => row.matrix)).toEqual(
      expect.arrayContaining([
        "requirement",
        "file",
        "source_object",
        "route",
        "mutation",
        "telemetry_audit",
        "ci_release_gate",
      ])
    );
    expect(matrix.find((row) => row.key === "phase-14-verification-matrix")).toMatchObject({
      matrix: "requirement",
      releaseEvidenceId: "v10-release:requirement:phase-14-verification-matrix",
      status: "runtime_backed",
    });
    expect(matrix.find((row) => row.matrix === "ci_release_gate" && row.key === "npm run check:release-suite-current")).toMatchObject({
      owner: "release",
      auditAction: "release.gate_verified",
      privacyClassification: "synthetic_only",
    });
    expect(
      validateV10NoExclusionsVerificationMatrix([
        {
          matrix: "requirement",
          key: "broken",
          priority: "P1",
          owner: "engineering",
          runtimeArtifact: "",
          dataArtifact: "",
          uiArtifact: "",
          mutationApiArtifact: "",
          testArtifact: "",
          releaseEvidenceId: "broken",
          telemetryEvent: "legacy.event" as never,
          auditAction: "audit",
          privacyClassification: "diagnostic_safe",
          rollbackPlan: "Use raw token.",
          status: "runtime_backed",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "verification_matrix_missing:file",
        "requirement:broken:runtime_artifact_required",
        "requirement:broken:release_evidence_required",
        "requirement:broken:telemetry_event_required",
        "requirement:broken:audit_action_required",
        "requirement:broken:rollback_plan_not_support_safe",
      ])
    );
  });

  it("locks file ownership for every V10 implementation area before broad execution", () => {
    expect(V10_FILE_OWNERSHIP_MAP.map((row) => row.area)).toEqual(expect.arrayContaining([...V10_REQUIRED_FILE_OWNERSHIP_AREAS]));
    for (const row of V10_FILE_OWNERSHIP_MAP) {
      expect(row.pathPrefix, row.area).toBeTruthy();
      expect(row.requiredProof.length, row.area).toBeGreaterThan(0);
    }
  });

  it("tracks claim-vs-proof status so shipped rows cannot be metadata-only", () => {
    const rows = buildV10ClaimVsProofRows();
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.filter((row) => row.claim === "shipped").map((row) => row.proofState)).not.toContain(
      "static_or_contract_only"
    );
    for (const row of rows) {
      expect(row.artifacts.length, row.id).toBeGreaterThan(0);
      expect(row.gates.length, row.id).toBeGreaterThan(0);
      if (row.claim === "shipped") expect(row.failingGap, row.id).toBeNull();
    }
  });

  it("freezes deprecation candidates and compatibility boundaries for cleanup-safe execution", () => {
    expect(validateV10DeprecationCleanupDecisions()).toEqual([]);
    expect(V10_DEPRECATION_CANDIDATES.map((row) => row.category)).toEqual(
      expect.arrayContaining([
        "duplicate_queue",
        "legacy_audit",
        "v9_label",
        "placeholder_gate",
        "descriptor_fixture",
        "duplicate_e2e",
        "metadata_only_claim",
      ])
    );
    for (const candidate of V10_DEPRECATION_CANDIDATES) {
      expect(V10_MASTER_PLAN_TODO_IDS).toContain(candidate.removalGate);
      expect(candidate.replacement.length, candidate.key).toBeGreaterThan(10);
    }
    expect(V10_DEPRECATION_CLEANUP_DECISIONS.map((decision) => decision.candidateId).sort()).toEqual(
      V10_DEPRECATION_CANDIDATES.map((candidate) => candidate.key).sort()
    );
    expect(V10_DEPRECATION_CLEANUP_DECISIONS.find((decision) => decision.candidateId === "descriptor_only_rc_fixtures")).toMatchObject({
      action: "retire",
      runtimeReplacementProof: "src/lib/objective-measurements.ts",
      testsPreserved: true,
    });
    expect(V10_DEPRECATION_CLEANUP_DECISIONS.find((decision) => decision.candidateId === "v9_release_contract_bridge")).toMatchObject({
      action: "preserve_boundary",
      runtimeReplacementProof: "src/lib/release-contract.ts",
      compatibilityBoundaryKey: "v9_regression_bridge",
      testsPreserved: true,
    });
    expect(V10_DEPRECATION_CLEANUP_DECISIONS.find((decision) => decision.candidateId === "legacy_exception_assigned_audit_alias")).toMatchObject({
      action: "quarantine",
      runtimeReplacementProof: "src/app/api/exceptions/[id]/[action]/route.ts",
      compatibilityBoundaryKey: "v10_audit_action_names",
      testsPreserved: true,
    });
    expect(V10_COMPATIBILITY_BOUNDARIES.map((row) => row.boundary)).toEqual(expect.arrayContaining([...V10_REQUIRED_COMPATIBILITY_BOUNDARIES]));
    expect(
      validateV10DeprecationCleanupDecisions({
        decisions: [
          {
            candidateId: "descriptor_only_rc_fixtures",
            action: "preserve_boundary",
            supersededBy: "wrong",
            runtimeReplacementProof: "",
            releaseEvidenceId: "wrong",
            compatibilityBoundaryKey: "unknown",
            testsPreserved: false,
            cleanupCommand: "node cleanup.js",
          },
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        "deprecation_decision_missing:work_legacy_queue_summary",
        "descriptor_only_rc_fixtures:supersession_mismatch",
        "descriptor_only_rc_fixtures:runtime_replacement_proof_required",
        "descriptor_only_rc_fixtures:release_evidence_key_required",
        "descriptor_only_rc_fixtures:compatibility_boundary_unknown",
        "descriptor_only_rc_fixtures:tests_preservation_required",
        "descriptor_only_rc_fixtures:stable_cleanup_command_required",
        "descriptor_only_rc_fixtures:placeholder_or_descriptor_must_not_be_preserved",
      ])
    );
  });
});

