import { describe, expect, it } from "vitest";
import {
  V10_DOMAIN_COVERAGE_MATRICES,
  buildV10ReleaseHandoffPackets,
  buildV10ZeroExclusionManifest,
  validateV10DomainCoverageMatrices,
  validateV10ReleaseHandoffPackets,
  validateV10ZeroExclusionManifest,
  type V10ZeroExclusionManifestRow,
} from "./v10-zero-exclusion-report";
import { V10_GA_SAMPLE_SIZES } from "./v10-release-contract";
import {
  V10_COMPATIBILITY_BOUNDARIES,
  V10_DEPRECATION_CLEANUP_DECISIONS,
} from "./v10-final-gap-audit";
import { V10_POST_GA_DRIFT_CONTROLS } from "./v10-operational-contracts";

describe("V10 final zero-exclusion report", () => {
  it("builds a release-blocking manifest across fixtures, compatibility, drift, verification, domains, handoff, and cleanup", () => {
    const manifest = buildV10ZeroExclusionManifest();

    expect(validateV10ZeroExclusionManifest(manifest)).toEqual([]);
    expect(new Set(manifest.map((row) => row.category))).toEqual(
      new Set([
        "complete_closure",
        "fixture_measurement",
        "compatibility_boundary",
        "post_ga_drift",
        "verification_gate",
        "domain_matrix",
        "release_handoff",
        "cleanup_decision",
      ])
    );
    expect(manifest.every((row) => row.owner && row.runtimeArtifact && row.releaseEvidenceKey)).toBe(true);
    expect(manifest.every((row) => row.testArtifacts.length > 0)).toBe(true);
    expect(manifest.every((row) => row.supportBoundary.trim() && row.rollbackPath.trim())).toBe(true);
  });

  it("locks fixture measurement and release-candidate evidence rows for every GA metric", () => {
    const manifest = buildV10ZeroExclusionManifest();
    const metricKeys = Object.keys(V10_GA_SAMPLE_SIZES);

    for (const metricKey of metricKeys) {
      expect(manifest.some((row) => row.coverageKey === `metric-capture:${metricKey}`), metricKey).toBe(true);
      expect(manifest.some((row) => row.coverageKey === `metric-requirement:${metricKey}`), metricKey).toBe(true);
    }
    expect(
      manifest
        .filter((row) => row.coverageKey.startsWith("metric-capture:"))
        .every((row) => row.status === "release_evidence_required" && row.blockerState === "release_candidate_capture_required")
    ).toBe(true);
  });

  it("preserves or cleans up every compatibility boundary and legacy cleanup decision", () => {
    const manifest = buildV10ZeroExclusionManifest();

    for (const boundary of V10_COMPATIBILITY_BOUNDARIES) {
      expect(manifest.find((row) => row.coverageKey === `compatibility:${boundary.key}`)).toMatchObject({
        runtimeArtifact: boundary.owningArtifact,
        supportBoundary: `compatibility_boundary:${boundary.boundary}`,
      });
    }
    for (const decision of V10_DEPRECATION_CLEANUP_DECISIONS) {
      expect(manifest.find((row) => row.coverageKey === `cleanup:${decision.candidateKey}`)).toMatchObject({
        releaseEvidenceKey: decision.releaseEvidenceKey,
        runtimeArtifact: decision.runtimeReplacementProof,
      });
    }
  });

  it("tracks post-GA drift with owner, dashboard evidence, rollback, and support-safe escalation", () => {
    const manifest = buildV10ZeroExclusionManifest();

    for (const control of V10_POST_GA_DRIFT_CONTROLS) {
      expect(manifest.find((row) => row.coverageKey === `post-ga-drift:${control.key}`)).toMatchObject({
        owner: control.owner,
        blockerState: "post_ga_window_required",
        rollbackPath: control.rollbackCommand,
        supportBoundary: control.supportSafeEscalation,
      });
    }
  });

  it("produces domain matrices and release handoff packets for beta, GA, complete, support, operations, security, rollback, and post-GA", () => {
    const packets = buildV10ReleaseHandoffPackets();

    expect(validateV10DomainCoverageMatrices()).toEqual([]);
    expect(validateV10ReleaseHandoffPackets(packets)).toEqual([]);
    expect(V10_DOMAIN_COVERAGE_MATRICES.map((matrix) => matrix.domainKey)).toEqual(
      expect.arrayContaining([
        "activation",
        "work",
        "contract_record",
        "review_data_quality",
        "renewal",
        "evidence",
        "approval_exception",
        "reporting_export",
        "search",
        "settings_governance",
        "jobs_notifications",
        "advanced_assurance",
        "support",
        "release",
      ])
    );
    expect(packets.map((packet) => packet.packetKey)).toEqual([
      "beta",
      "GA",
      "complete",
      "support",
      "operations",
      "security",
      "rollback",
      "post_ga",
    ]);
  });

  it("fails promotion rows that lack evidence, rollback, support, ownership, or block-state semantics", () => {
    const [row] = buildV10ZeroExclusionManifest();
    const broken: V10ZeroExclusionManifestRow = {
      ...row,
      owner: "" as V10ZeroExclusionManifestRow["owner"],
      runtimeArtifact: "",
      testArtifacts: [],
      releaseEvidenceKey: "missing",
      supportBoundary: "",
      rollbackPath: "",
      status: "release_evidence_required",
      blockerState: null,
    };

    expect(validateV10ZeroExclusionManifest([broken])).toEqual(
      expect.arrayContaining([
        `${broken.coverageKey}:owner_required`,
        `${broken.coverageKey}:runtime_artifact_required`,
        `${broken.coverageKey}:test_artifact_required`,
        `${broken.coverageKey}:release_evidence_key_required`,
        `${broken.coverageKey}:support_boundary_required`,
        `${broken.coverageKey}:rollback_path_required`,
        `${broken.coverageKey}:release_blocker_state_required`,
        "category_missing:fixture_measurement",
        "category_missing:compatibility_boundary",
        "category_missing:post_ga_drift",
        "category_missing:verification_gate",
        "category_missing:domain_matrix",
        "category_missing:release_handoff",
        "category_missing:cleanup_decision",
      ])
    );
  });
});
