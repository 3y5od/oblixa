import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V10_ACCEPTANCE_GATES } from "./v10-release-contract";
import {
  V10_ARTIFACT_CLASS_DEFINITIONS_OF_DONE,
  V10_IMPLEMENTATION_REQUIREMENTS,
  buildV10ArtifactDefinitionOfDone,
  getV10AutonomousRequirementCoverage,
  getV10ImplementationRequirementsForGate,
  validateV10ArtifactClassDefinitionsOfDone,
  validateV10ArtifactDefinitionOfDone,
} from "./v10-implementation-checklist";
import { V10_SPEC_TRACE } from "./v10-spec-trace-map";

describe("V10 autonomous implementation checklist", () => {
  it("covers every acceptance gate with at least one autonomous runtime or evidence requirement", () => {
    const coverage = getV10AutonomousRequirementCoverage();

    for (const gate of V10_ACCEPTANCE_GATES) {
      expect(coverage[gate], gate).toBeGreaterThan(0);
      expect(getV10ImplementationRequirementsForGate(gate).length, gate).toBeGreaterThan(0);
    }
    const ids = V10_IMPLEMENTATION_REQUIREMENTS.map((requirement) => requirement.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(V10_IMPLEMENTATION_REQUIREMENTS.map((requirement) => requirement.priority)).toEqual(
      expect.arrayContaining(["P0", "P1", "P2"])
    );
    expect(V10_IMPLEMENTATION_REQUIREMENTS.map((requirement) => requirement.layer)).toEqual(
      expect.arrayContaining(["runtime_data", "mutation", "ui", "api", "release_evidence", "test"])
    );
  });

  it("keeps every mapped artifact present in the repository", () => {
    for (const requirement of V10_IMPLEMENTATION_REQUIREMENTS) {
      expect(requirement.specSections.length, requirement.id).toBeGreaterThan(0);
      expect(requirement.artifacts.length, requirement.id).toBeGreaterThan(0);
      for (const section of requirement.specSections) {
        expect(V10_SPEC_TRACE[section]?.length, `${requirement.id}:${section}`).toBeGreaterThan(0);
      }
      for (const artifact of requirement.artifacts) {
        expect(existsSync(join(process.cwd(), artifact)), `${requirement.id}:${artifact}`).toBe(true);
      }
    }
  });

  it("explicitly separates repo-autonomous work from external launch evidence", () => {
    const external = V10_IMPLEMENTATION_REQUIREMENTS.filter((requirement) => !requirement.autonomous);

    expect(external.map((requirement) => requirement.id)).toEqual([
      "external-launch-evidence-placeholders",
    ]);
    expect(external[0].artifacts).toContain("src/lib/v10-release-evidence.ts");
    expect(external[0].layer).toBe("release_evidence");
    expect(external[0].specSections).toEqual(expect.arrayContaining(["2.2", "8"]));
  });

  it("enforces a definition of done for every mapped V10 artifact", () => {
    const dod = buildV10ArtifactDefinitionOfDone();

    expect(validateV10ArtifactDefinitionOfDone(dod)).toEqual([]);
    expect(dod).toHaveLength(V10_IMPLEMENTATION_REQUIREMENTS.length);
    expect(dod.find((row) => row.requirementId === "activation-state-runtime")).toMatchObject({
      runtimePath: "src/lib/v10-activation-state.ts",
      sourceInventoryCovered: true,
      routeOrActionCovered: true,
      authzCovered: true,
      orgIsolationCovered: true,
      eligibilityCovered: true,
      mutationEnvelopeCovered: false,
      auditCovered: true,
      transactionalAuditCovered: true,
      idempotencyCovered: true,
      telemetryCovered: true,
      privacySafeTelemetryCovered: true,
      recoverabilityCovered: true,
      readModelFreshnessCovered: true,
      privacyCovered: true,
      accessibilityCovered: true,
      performanceCovered: true,
      abuseCaseCovered: true,
      concurrencyCovered: true,
      testsCovered: true,
      fixtureCoverage: true,
      releaseEvidenceCovered: true,
      rollbackRepairCovered: true,
    });
    expect(
      validateV10ArtifactDefinitionOfDone([
        {
          requirementId: "activation-state-runtime",
          runtimePath: "",
          sourceInventoryCovered: false,
          routeOrActionCovered: false,
          authzCovered: false,
          orgIsolationCovered: false,
          eligibilityCovered: false,
          mutationEnvelopeCovered: false,
          auditCovered: false,
          transactionalAuditCovered: false,
          idempotencyCovered: false,
          telemetryCovered: false,
          privacySafeTelemetryCovered: false,
          recoverabilityCovered: false,
          readModelFreshnessCovered: false,
          privacyCovered: false,
          accessibilityCovered: false,
          performanceCovered: false,
          abuseCaseCovered: false,
          concurrencyCovered: false,
          testsCovered: false,
          fixtureCoverage: false,
          releaseEvidenceCovered: false,
          rollbackRepairCovered: false,
          rollbackNotes: "",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation-state-runtime:runtime_path_required",
        "activation-state-runtime:source_inventory_required",
        "activation-state-runtime:route_or_action_required",
        "activation-state-runtime:authz_required",
        "activation-state-runtime:org_isolation_required",
        "activation-state-runtime:eligibility_required",
        "activation-state-runtime:audit_required",
        "activation-state-runtime:transactional_audit_required",
        "activation-state-runtime:idempotency_required",
        "activation-state-runtime:telemetry_required",
        "activation-state-runtime:privacy_safe_telemetry_required",
        "activation-state-runtime:recoverability_required",
        "activation-state-runtime:read_model_freshness_required",
        "activation-state-runtime:privacy_required",
        "activation-state-runtime:accessibility_required",
        "activation-state-runtime:performance_required",
        "activation-state-runtime:abuse_case_required",
        "activation-state-runtime:concurrency_required",
        "activation-state-runtime:tests_required",
        "activation-state-runtime:fixture_coverage_required",
        "activation-state-runtime:release_evidence_required",
        "activation-state-runtime:rollback_repair_required",
        "activation-state-runtime:rollback_notes_required",
        "dod_missing:unified-work-inbox",
      ])
    );
  });

  it("applies the artifact-level definition of done to every artifact class in the plan", () => {
    expect(validateV10ArtifactClassDefinitionsOfDone()).toEqual([]);
    expect(V10_ARTIFACT_CLASS_DEFINITIONS_OF_DONE.map((row) => row.classKey)).toEqual([
      "schema",
      "read_model",
      "mutation",
      "api_route",
      "server_action",
      "ui_surface",
      "job",
      "telemetry_event",
      "test",
      "release_evidence",
    ]);
    expect(V10_ARTIFACT_CLASS_DEFINITIONS_OF_DONE.find((row) => row.classKey === "mutation")).toMatchObject({
      requiredProofs: expect.arrayContaining(["idempotency", "expected_version", "transactional_audit", "private_no_store"]),
      releaseBlocker: true,
    });
    expect(
      validateV10ArtifactClassDefinitionsOfDone([
        {
          classKey: "schema",
          ownerArtifacts: [],
          requiredProofs: ["migration"],
          releaseBlocker: false,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "artifact_class_missing:read_model",
        "schema:owner_artifact_required",
        "schema:proof_depth_required",
        "schema:must_block_release",
        "schema:rls_required",
      ])
    );
  });
});
