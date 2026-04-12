import { describe, expect, it } from "vitest";
import { setupChecklistKeyLabels } from "@/lib/onboarding/calibration-copy";
import { SETUP_CHECKLIST_POSSIBLE_KEYS } from "@/lib/onboarding/calibration-map";

describe("setup checklist copy parity", () => {
  it("every possible setupChecklist key has a user-visible label", () => {
    for (const key of SETUP_CHECKLIST_POSSIBLE_KEYS) {
      expect(setupChecklistKeyLabels[key].length).toBeGreaterThan(2);
    }
  });
});
