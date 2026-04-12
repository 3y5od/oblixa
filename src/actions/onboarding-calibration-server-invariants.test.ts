import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/lib/rate-limit";

describe("onboarding-calibration server invariants", () => {
  it("keeps rate-limit buckets wired from onboarding-calibration and gate", () => {
    const calibration = readFileSync(
      join(process.cwd(), "src/actions/onboarding-calibration.ts"),
      "utf8"
    );
    const gate = readFileSync(join(process.cwd(), "src/lib/onboarding/calibration-gate.ts"), "utf8");
    const combined = `${calibration}\n${gate}`;
    expect(combined).toContain("RATE_LIMITS.onboardingCalibrationMutation");
    expect(combined).toContain("RATE_LIMITS.onboardingCalibrationPreview");
    expect(combined).toContain("RATE_LIMITS.onboardingCalibrationExport");
    expect(combined).toContain("RATE_LIMITS.onboardingCalibrationGateUser");
    expect(combined).toContain("RATE_LIMITS.onboardingCalibrationGateAdmin");
    expect(RATE_LIMITS.onboardingCalibrationMutation).toBeDefined();
  });

  it("revalidateCalibrationSurfaces lists core dashboard and settings paths", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/actions/onboarding-calibration.ts"),
      "utf8"
    );
    expect(raw).toContain("function revalidateCalibrationSurfaces");
    expect(raw).toContain('revalidatePath("/dashboard")');
    expect(raw).toContain('revalidatePath("/settings/product")');
    expect(raw).toContain('revalidatePath("/onboarding/calibration")');
  });

  it("requires admin for export and mutation entry points (static)", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/actions/onboarding-calibration.ts"),
      "utf8"
    );
    const adminChecks = raw.match(/ctx\.role !== "admin"/g) ?? [];
    expect(adminChecks.length).toBeGreaterThanOrEqual(8);
  });

  it("lists onboarding calibration stale cron in expected-keys script", () => {
    const raw = readFileSync(
      join(process.cwd(), "scripts/cron-route-expected-keys.mjs"),
      "utf8"
    );
    expect(raw).toContain("/api/cron/v6/onboarding-calibration-stale");
  });
});
