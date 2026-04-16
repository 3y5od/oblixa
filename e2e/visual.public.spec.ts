import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";
import { VISUAL_ENABLED, snapshotName } from "./visual-helpers";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=visual_baselines_feature_flag_gated

test.describe("visual public surfaces", () => {
  test.skip(!VISUAL_ENABLED, "Set PLAYWRIGHT_VISUAL=1 to run screenshot baselines.");

  for (const route of GENERATED_PUBLIC_ROUTES.filter((entry) => entry.coverage.includes("visual"))) {
    test(`${route.route} matches public visual baseline`, async ({ page }) => {
      await page.goto(route.visitPath, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveScreenshot(snapshotName("public", route.route), {
        fullPage: true,
      });
    });
  }
});

