import { test, expect } from "./fixtures/app-fixture";
import { VISUAL_AUTH_ENABLED } from "./visual-helpers";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=visual_baselines_feature_flag_gated

test.describe("visual shell", () => {
  test.skip(!VISUAL_AUTH_ENABLED, "Set PLAYWRIGHT_VISUAL=1 and PLAYWRIGHT_VISUAL_AUTH=1 for authenticated screenshots.");

  test("dashboard shell matches baseline", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveScreenshot("shell-dashboard.png", {
      fullPage: true,
    });
  });
});

