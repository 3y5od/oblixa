import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Required audit_actions emitted by product-surface-settings transitions (V7 §21.1). */
const REQUIRED_WORKSPACE_AUDIT_ACTIONS = [
  "workspace.report_pack_subscriptions_suppressed",
  "workspace.product_surface_updated",
  "workspace.product_surface_reset_defaults",
  "workspace.notification_policy_updated",
] as const;

const SETTINGS_FILE = join(process.cwd(), "src/actions/product-surface-settings.ts");
const WORKSPACE_TRANSITION_FILE = join(
  process.cwd(),
  "src/lib/product-surface/workspace-transition.ts"
);

describe("product-surface-settings audit event coverage", () => {
  it("inserts every required workspace audit action string (settings + workspace-transition)", () => {
    const settingsRaw = readFileSync(SETTINGS_FILE, "utf8");
    const transitionRaw = readFileSync(WORKSPACE_TRANSITION_FILE, "utf8");
    const combined = `${settingsRaw}\n${transitionRaw}`;
    for (const action of REQUIRED_WORKSPACE_AUDIT_ACTIONS) {
      expect(combined.includes(`action: "${action}"`), action).toBe(true);
    }
  });

  it("emits onboarding post-calibration mode change audit when settings change mode after calibration", () => {
    const raw = readFileSync(SETTINGS_FILE, "utf8");
    expect(raw.includes('action: "onboarding.post_calibration_mode_changed"')).toBe(true);
  });
});
