import { describe, expect, it } from "vitest";
import {
  buildV10PromotabilityBaseline,
  evaluateV10Promotability,
  validateV10PromotabilityBaseline,
  type V10PromotabilityBaselineRow,
} from "./v10-promotability";

describe("V10 promotability baseline", () => {
  it("builds a failing baseline for static, descriptor, release-check, environment, and external proof", () => {
    const rows = buildV10PromotabilityBaseline();
    const proofKinds = new Set(rows.map((row) => row.proofKind));

    expect(validateV10PromotabilityBaseline(rows)).toEqual([]);
    expect(proofKinds).toEqual(
      new Set([
        "runtime_backed",
        "static_or_contract_only",
        "release_check_required",
        "external_blocker",
      ])
    );
    expect(rows.find((row) => row.key === "coverage:route-surface-parity")).toMatchObject({
      proofKind: "runtime_backed",
      blocker: null,
    });
    expect(rows.find((row) => row.key === "metric:activation")).toMatchObject({
      proofKind: "release_check_required",
      evidenceKeys: ["v10-release:objective-metric:activation"],
      blocker: "metric:activation:release_evidence_must_be_promoted",
    });
    expect(rows.find((row) => row.key === "coverage:end-to-end-journeys")).toMatchObject({
      proofKind: "runtime_backed",
      blocker: null,
    });
    expect(rows.find((row) => row.key === "external:human_usability_sessions")).toMatchObject({
      proofKind: "external_blocker",
      blocker: "external:human_usability_sessions:external_evidence_must_be_promoted",
    });
  });

  it("blocks complete promotion until every static and release-only row is replaced or promoted", () => {
    const evaluation = evaluateV10Promotability({ stage: "complete" });

    expect(evaluation.canPromote).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        "acceptance:artifact-definition-of-done:runtime_proof_required",
        "metric:activation:release_evidence_must_be_promoted",
        "external:post_ga_observation_window:external_evidence_must_be_promoted",
      ])
    );
    expect(evaluation.counts.static_or_contract_only).toBeGreaterThan(0);
    expect(evaluation.counts.release_check_required).toBeGreaterThan(0);
    expect(evaluation.counts.external_blocker).toBeGreaterThan(0);
  });

  it("allows promoted evidence to clear evidence rows without clearing static-only runtime blockers", () => {
    const rows = buildV10PromotabilityBaseline({
      promotedEvidenceKeys: [
        "v10-release:objective-metric:activation",
        "v10-release:external-gate:human_usability_sessions",
      ],
    });

    expect(rows.find((row) => row.key === "metric:activation")).toMatchObject({
      promotedEvidenceSatisfied: true,
      blocker: null,
    });
    expect(rows.find((row) => row.key === "external:human_usability_sessions")).toMatchObject({
      promotedEvidenceSatisfied: true,
      blocker: null,
    });
    expect(rows.find((row) => row.key === "acceptance:artifact-definition-of-done")?.blocker).toBe(
      "acceptance:artifact-definition-of-done:runtime_proof_required"
    );
  });

  it("rejects malformed baselines that would let contract-only proof promote silently", () => {
    const rows: V10PromotabilityBaselineRow[] = [
      {
        key: "runtime:ok",
        source: "acceptance_matrix",
        proofKind: "runtime_backed",
        stageImpact: "blocks_beta",
        evidenceKeys: [],
        promotedEvidenceSatisfied: false,
        blocker: null,
      },
      {
        key: "static:bad",
        source: "acceptance_matrix",
        proofKind: "static_or_contract_only",
        stageImpact: "blocks_complete",
        evidenceKeys: [],
        promotedEvidenceSatisfied: true,
        blocker: null,
      },
    ];

    expect(validateV10PromotabilityBaseline(rows)).toEqual(
      expect.arrayContaining([
        "static:bad:static_row_must_block_runtime_promotion",
      ])
    );
  });
});
