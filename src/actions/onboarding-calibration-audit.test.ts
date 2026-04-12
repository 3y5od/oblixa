import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ONBOARDING_AUDIT_ACTIONS = [
  "onboarding.questionnaire_started",
  "onboarding.questionnaire_completed",
  "onboarding.questionnaire_skipped",
  "onboarding.recalibration_run",
  "onboarding.recommendation_generated",
  "onboarding.recommendation_accepted",
  "onboarding.recommendation_overridden",
  "onboarding.calibration_applied",
  "onboarding.calibration_error",
  "onboarding.calibration_support_export",
] as const;

const FILE = join(process.cwd(), "src/actions/onboarding-calibration.ts");
const BLOCKING_MINIMAL = join(process.cwd(), "src/lib/onboarding/calibration-blocking-minimal.ts");

describe("onboarding-calibration audit strings", () => {
  it("references every required onboarding audit action", () => {
    const raw = readFileSync(FILE, "utf8");
    const minimal = readFileSync(BLOCKING_MINIMAL, "utf8");
    const combined = `${raw}\n${minimal}`;
    for (const action of ONBOARDING_AUDIT_ACTIONS) {
      expect(combined.includes(`action: "${action}"`), action).toBe(true);
    }
  });

  it("records last_applied snapshot fields after accept (§16)", () => {
    const raw = readFileSync(FILE, "utf8");
    expect(raw).toContain("last_applied");
    expect(raw).toContain("buildAppliedSnapshot");
  });
});
