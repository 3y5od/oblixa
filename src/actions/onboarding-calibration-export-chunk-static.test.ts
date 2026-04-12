import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("exportOnboardingCalibrationSupportJson static surface", () => {
  it("export chunk enforces max-bytes guard and rate-limit messaging", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/onboarding-calibration.ts"), "utf8");
    const start = raw.indexOf("export async function exportOnboardingCalibrationSupportJson");
    expect(start).toBeGreaterThan(-1);
    const chunk = raw.slice(start, start + 4500);
    expect(chunk).toContain("EXPORT_ONBOARDING_CALIBRATION_JSON_MAX_BYTES");
    expect(chunk).toContain("Export too large.");
    expect(chunk).toContain('rateLimitOnboardingCalibration(ctx.user.id, "export")');
  });
});
