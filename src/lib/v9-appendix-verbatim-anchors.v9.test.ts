import { describe, expect, it } from "vitest";
import { SPEC_ARTIFACT_V10, SPEC_ARTIFACT_V9_ARCHIVE } from "./spec-artifact-ids";
import { V9_REGRESSION_GATES, V9_RELIABILITY_STATES, V9_SUPERSESSION_RECORDS } from "./v9-release-contract";
import { V9_SECTION_30_PREAMBLE_VERBATIM } from "./v9-section-30-preamble";

/**
 * Appendix A (plan) — key phrases stay codified without depending on external docs files.
 */
describe("V9 Appendix A verbatim doc anchors", () => {
  it("§30 preamble line stays codified", () => {
    expect(V9_SECTION_30_PREAMBLE_VERBATIM).toBe("V9 is complete only when all conditions below are true.");
  });

  it("§29.2 regression bullets from v9-plan-enforcement-bundles remain codified", () => {
    expect(V9_REGRESSION_GATES).toHaveLength(4);
  });

  it("§27.2 reliability state vocabulary from v9-reliability-states-27-2 remains codified", () => {
    expect(V9_RELIABILITY_STATES).toHaveLength(8);
  });

  it("keeps V9 supersession explicit while preserving regression gates", () => {
    expect(V9_SUPERSESSION_RECORDS.map((record) => record.artifact)).toEqual([SPEC_ARTIFACT_V9_ARCHIVE, "logs 1.zip", "logs 2.zip"]);
    expect(V9_SUPERSESSION_RECORDS.every((record) => record.testsPreserved)).toBe(true);
    expect(V9_SUPERSESSION_RECORDS.find((record) => record.artifact === SPEC_ARTIFACT_V9_ARCHIVE)).toMatchObject({
      supersededBy: SPEC_ARTIFACT_V10,
      status: "superseded_bridge_preserved",
      releaseEvidenceKey: "v10_deprecation_policy",
    });
  });
});
