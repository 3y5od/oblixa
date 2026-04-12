import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = join(process.cwd(), "src/actions/onboarding-calibration.ts");

/**
 * Fail CI when a new server action export is added without updating rate-limit / audit coverage tests.
 */
describe("onboarding-calibration action registry", () => {
  it("every export async function is listed (intentional allowlist)", () => {
    const raw = readFileSync(FILE, "utf8");
    const names = [...raw.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    names.sort();
    expect(names).toEqual([
      "beginRecalibration",
      "completeQuestionnaireAcceptRecommendation",
      "completeQuestionnaireOpenAdvancedSettings",
      "completeQuestionnaireSimplerSetup",
      "exportOnboardingCalibrationSupportJson",
      "previewCalibrationRecommendation",
      "recordQuestionnaireStarted",
      "saveQuestionnaireProgress",
      "skipQuestionnaireExplicitMinimal",
      "startRecalibrationFromSettingsForm",
    ]);
  });
});
