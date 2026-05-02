import { describe, expect, it } from "vitest";
import { V10_REQUIRED_ACCEPTANCE_IDS } from "./v10-acceptance-matrix";
import {
  buildV10OperationalHandoffArtifacts,
  createV10ReadinessSignalsFromAcceptanceMatrix,
  createV10ReleaseHandoffArtifact,
  scoreV10Readiness,
  validateV10OperationalHandoffArtifacts,
} from "./v10-readiness-scorecard";
import { V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS } from "./v10-release-evidence";

describe("V10 release readiness scorecard", () => {
  const signals = [
    {
      key: "activation",
      priority: "P0",
      structuralGatesDefined: true,
      localAutomationPassed: true,
      releaseEvidencePromoted: true,
      evidenceState: "promoted",
    },
    {
      key: "work",
      priority: "P1",
      structuralGatesDefined: true,
      localAutomationPassed: true,
      releaseEvidencePromoted: false,
      evidenceState: "pending_external",
    },
    {
      key: "automation",
      priority: "P2",
      structuralGatesDefined: true,
      localAutomationPassed: false,
      releaseEvidencePromoted: false,
      evidenceState: "stale",
    },
  ] as const;

  it("requires P0 for beta readiness", () => {
    expect(scoreV10Readiness("beta", signals)).toMatchObject({
      requiredPassed: true,
      missingRequiredKeys: [],
    });
  });

  it("requires P0 and P1 for GA readiness", () => {
    expect(scoreV10Readiness("GA", signals)).toMatchObject({
      requiredPassed: false,
      missingRequiredKeys: ["work"],
      pendingExternalEvidenceKeys: ["work"],
    });
  });

  it("requires all priorities for complete readiness", () => {
    expect(scoreV10Readiness("complete", signals)).toMatchObject({
      requiredPassed: false,
      missingRequiredKeys: ["work", "automation"],
      pendingExternalEvidenceKeys: ["work"],
      invalidEvidenceKeys: ["automation"],
    });
  });

  it("derives readiness signals from the acceptance matrix for final handoff", () => {
    const derived = createV10ReadinessSignalsFromAcceptanceMatrix();
    expect(derived).toHaveLength(V10_REQUIRED_ACCEPTANCE_IDS.length);
    expect(derived.map((signal) => signal.key)).toEqual(V10_REQUIRED_ACCEPTANCE_IDS);
    expect(derived.find((signal) => signal.key === "fixture-measurement-gates")).toMatchObject({
      structuralGatesDefined: true,
      localAutomationPassed: true,
      evidenceState: "promoted",
    });
    expect(scoreV10Readiness("GA", derived).pendingExternalEvidenceKeys).toEqual([]);
    expect(
      scoreV10Readiness(
        "GA",
        createV10ReadinessSignalsFromAcceptanceMatrix(
          undefined,
          V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.map((requirement) => requirement.persistence_key)
        )
      )
        .pendingExternalEvidenceKeys
    ).not.toContain("non-autonomous-evidence-schema");
  });

  it("builds a release handoff artifact with verification and rollback paths", () => {
    const handoff = createV10ReleaseHandoffArtifact({
      stage: "GA",
      signals,
      generatedAt: "2026-04-26T16:00:00Z",
    });

    expect(handoff.canPromote).toBe(false);
    expect(handoff.releaseBlockers).toEqual(["work"]);
    expect(handoff.externalEvidenceBlockers).toEqual(["work"]);
    expect(handoff.verificationCommands).toEqual(
      expect.arrayContaining(["npm run check:v10-release-evidence", "npm run check:v10-suite", "npm run typecheck"])
    );
    expect(handoff.rollbackRunbooks).toEqual(expect.arrayContaining(["read_model_refresh_repair", "incident_kill_switch"]));
    expect(handoff.operationalHandoffArtifacts.map((artifact) => artifact.artifactKind)).toEqual(
      expect.arrayContaining(["support", "operations", "release", "rollback", "incident", "canary", "provider_readiness", "post_release"])
    );
    expect(handoff.generatedAt).toBe("2026-04-26T16:00:00Z");
  });

  it("builds operational handoff artifacts with owners, runbooks, freshness, and evidence keys", () => {
    const artifacts = buildV10OperationalHandoffArtifacts();
    expect(validateV10OperationalHandoffArtifacts(artifacts)).toEqual([]);
    expect(artifacts.find((artifact) => artifact.artifactKind === "rollback")).toMatchObject({
      owner: "release",
      runbookKey: "release_rollback",
      recoveryDestination: "/settings/health#rollback",
      releaseEvidenceKey: "ops:rollback_repair",
    });
    expect(artifacts.find((artifact) => artifact.artifactKind === "provider_readiness")).toMatchObject({
      owner: "operations",
      runbookKey: "provider_outage",
      recoveryDestination: "/settings/health#providers",
    });
    expect(
      validateV10OperationalHandoffArtifacts([
        {
          artifactKind: "support",
          owner: "support",
          freshnessHours: 0,
          runbookKey: "missing",
          verificationCommand: "echo ok",
          recoveryDestination: "/work",
          releaseEvidenceKey: "support",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "support:freshness_required",
        "support:runbook_unknown",
        "support:verification_command_required",
        "support:settings_health_destination_required",
        "support:release_evidence_key_required",
        "handoff_artifact_missing:operations",
      ])
    );
  });
});
