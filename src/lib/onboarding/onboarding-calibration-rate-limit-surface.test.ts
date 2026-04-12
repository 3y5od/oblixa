import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = join(process.cwd(), "src/actions/onboarding-calibration.ts");

function chunkForExportFunction(raw: string, fnName: string): string {
  const needle = `export async function ${fnName}`;
  const start = raw.indexOf(needle);
  expect(start, fnName).toBeGreaterThan(-1);
  const rest = raw.slice(start);
  const next = rest.slice(needle.length).search(/\nexport async function /);
  return next === -1 ? rest : rest.slice(0, needle.length + next);
}

/**
 * Plan C.1–C.3 — every mutating / preview / export entrypoint is rate-limited or delegates to one that is.
 */
describe("onboarding-calibration rate limit surface (static)", () => {
  it("wraps preview, mutations, and export with rateLimitOnboardingCalibration", () => {
    const raw = readFileSync(FILE, "utf8");
    const preview = chunkForExportFunction(raw, "previewCalibrationRecommendation");
    expect(preview).toContain('rateLimitOnboardingCalibration(ctx.user.id, "preview")');

    for (const fn of [
      "recordQuestionnaireStarted",
      "saveQuestionnaireProgress",
      "beginRecalibration",
      "completeQuestionnaireAcceptRecommendation",
      "completeQuestionnaireOpenAdvancedSettings",
    ] as const) {
      const ch = chunkForExportFunction(raw, fn);
      expect(ch, fn).toContain('rateLimitOnboardingCalibration(ctx.user.id, "mutation")');
    }

    const exportCh = chunkForExportFunction(raw, "exportOnboardingCalibrationSupportJson");
    expect(exportCh).toContain('rateLimitOnboardingCalibration(ctx.user.id, "export")');

    const simpler = chunkForExportFunction(raw, "completeQuestionnaireSimplerSetup");
    expect(simpler).toContain("completeMinimalPath");
    const skip = chunkForExportFunction(raw, "skipQuestionnaireExplicitMinimal");
    expect(skip).toContain("completeMinimalPath");

    const minimalStart = raw.indexOf("async function completeMinimalPath");
    expect(minimalStart).toBeGreaterThan(-1);
    const minimalEnd = raw.indexOf("export async function completeQuestionnaireOpenAdvancedSettings", minimalStart);
    expect(minimalEnd).toBeGreaterThan(minimalStart);
    expect(raw.slice(minimalStart, minimalEnd)).toContain(
      'rateLimitOnboardingCalibration(ctx.user.id, "mutation")'
    );

    const fromSettings = chunkForExportFunction(raw, "startRecalibrationFromSettingsForm");
    expect(fromSettings).toContain("beginRecalibration");
  });
});
