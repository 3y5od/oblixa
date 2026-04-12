import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_ICON_WRAP_BY_TONE,
  OPERATIONAL_SHELL_BY_TONE,
  operationalToneFromSignalSeverity,
  type OperationalTone,
} from "./operational-surface";

const TONES: OperationalTone[] = ["healthy", "neutral", "attention", "risk"];

describe("operational-surface", () => {
  it("defines shell + icon classes for every tone", () => {
    for (const t of TONES) {
      expect(OPERATIONAL_SHELL_BY_TONE[t].length).toBeGreaterThan(10);
      expect(OPERATIONAL_ICON_WRAP_BY_TONE[t].length).toBeGreaterThan(10);
    }
  });

  it("operationalToneFromSignalSeverity maps counts and severities", () => {
    expect(operationalToneFromSignalSeverity("high", 0)).toBe("healthy");
    expect(operationalToneFromSignalSeverity("high", 3)).toBe("risk");
    expect(operationalToneFromSignalSeverity("medium", 2)).toBe("attention");
    expect(operationalToneFromSignalSeverity("low", 5)).toBe("neutral");
  });
});
