import { describe, expect, it } from "vitest";
import { V10_NON_AUTONOMOUS_EVIDENCE_GATES, validateV10NonAutonomousEvidenceGateSet } from "./v10-release-evidence";

describe("V10 human and external evidence gates (repo-local promotion record)", () => {
  it("keeps the non-autonomous gate set structurally valid and promotion-recorded for CI", () => {
    expect(validateV10NonAutonomousEvidenceGateSet()).toEqual([]);
    for (const gate of V10_NON_AUTONOMOUS_EVIDENCE_GATES) {
      expect(gate.validation_status, gate.key).toBe("promoted");
      expect(gate.captured_at, gate.key).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(gate.blocker_reason, gate.key).toBeNull();
    }
  });
});
