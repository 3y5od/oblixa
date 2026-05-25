import { describe, expect, it } from "vitest";
import { EVIDENCE_GAP_STATUSES, isEvidenceGapStatus } from "./evidence-status";

describe("evidence status gap semantics (V9)", () => {
  it("treats only required and rejected evidence as actionable gaps", () => {
    expect(EVIDENCE_GAP_STATUSES).toEqual(["required", "rejected"]);
    expect(isEvidenceGapStatus("required")).toBe(true);
    expect(isEvidenceGapStatus("rejected")).toBe(true);
    expect(isEvidenceGapStatus("submitted")).toBe(false);
    expect(isEvidenceGapStatus("approved")).toBe(false);
  });
});
