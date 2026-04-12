import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ONBOARDING_CALIBRATION_JSON_VERSION } from "@/lib/onboarding/calibration-types";

describe("ONBOARDING_CALIBRATION_JSON_VERSION wiring", () => {
  it("writers reference the shared constant (bump forces concurrent fixture updates)", () => {
    const actions = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    expect(actions).toContain("ONBOARDING_CALIBRATION_JSON_VERSION");
    expect(actions).toMatch(/version:\s*ONBOARDING_CALIBRATION_JSON_VERSION/);
    expect(ONBOARDING_CALIBRATION_JSON_VERSION).toBeGreaterThanOrEqual(2);
  });

  it("calibration-types documents and exports the ladder constant for readers/writers", () => {
    const types = readFileSync(join(process.cwd(), "src/lib/onboarding/calibration-types.ts"), "utf8");
    expect(types).toContain("export const ONBOARDING_CALIBRATION_JSON_VERSION");
    expect(types).toMatch(/typeof o\.version !== "number"/);
  });
});
