import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * onboarding spec §20.1 — lifecycle strings recorded as audit_events (not outbound_events).
 */
const ONBOARDING_AUDIT_ACTIONS = [
  "onboarding.questionnaire_started",
  "onboarding.questionnaire_completed",
  "onboarding.questionnaire_skipped",
  "onboarding.questionnaire_stale_expired",
  "onboarding.recalibration_run",
  "onboarding.recommendation_generated",
  "onboarding.recommendation_accepted",
  "onboarding.recommendation_overridden",
  "onboarding.calibration_applied",
  "onboarding.calibration_error",
  "onboarding.calibration_support_export",
  "onboarding.post_calibration_mode_changed",
] as const;

describe("onboarding audit action inventory", () => {
  it("each onboarding.* audit action appears in source", () => {
    const files = [
      join(process.cwd(), "src/actions/onboarding-calibration.ts"),
      join(process.cwd(), "src/lib/onboarding/calibration-blocking-minimal.ts"),
      join(process.cwd(), "src/lib/onboarding/calibration-stale-run.ts"),
      join(process.cwd(), "src/actions/product-surface-settings.ts"),
    ];
    const combined = files.map((f) => readFileSync(f, "utf8")).join("\n");
    for (const action of ONBOARDING_AUDIT_ACTIONS) {
      expect(combined.includes(`action: "${action}"`), action).toBe(true);
    }
  });
});
