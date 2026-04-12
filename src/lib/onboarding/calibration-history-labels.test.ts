import { describe, expect, it } from "vitest";
import { calibrationHistoryChoiceLabels } from "@/lib/onboarding/calibration-copy";
import type { CalibrationHistoryEntry } from "@/lib/onboarding/calibration-types";

const EXPECTED_CHOICES: CalibrationHistoryEntry["choice"][] = [
  "accept",
  "recalibrate",
  "settings",
  "simpler",
  "skip",
];

describe("calibrationHistoryChoiceLabels", () => {
  it("defines a user-visible label for every history choice union member", () => {
    for (const c of EXPECTED_CHOICES) {
      expect(calibrationHistoryChoiceLabels[c].length).toBeGreaterThan(3);
    }
  });

  it("exhaustively covers CalibrationHistoryEntry.choice (no drift)", () => {
    const keys = Object.keys(calibrationHistoryChoiceLabels).sort();
    expect(keys).toEqual([...EXPECTED_CHOICES].sort());
  });
});
