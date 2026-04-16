import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_AUTHENTICATED_ROUTES } from "./generated/authenticated-routes";
import { VISUAL_ASSURANCE_ENABLED, snapshotName } from "./visual-helpers";
import { hasCoverage } from "@/lib/qa/generated-route-matrices";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=visual_baselines_feature_flag_gated

test.describe("visual assurance surfaces", () => {
  test.skip(!VISUAL_ASSURANCE_ENABLED, "Set PLAYWRIGHT_VISUAL=1 and PLAYWRIGHT_VISUAL_ASSURANCE=1 for assurance screenshots.");

  for (const route of GENERATED_AUTHENTICATED_ROUTES.filter(
    (entry) => hasCoverage(entry, "visual") && entry.workspaceModeTier === "assurance"
  )) {
    test(`${route.route} matches visual baseline`, async ({ page, app }) => {
      await app.loginAsDefaultUser();
      await page.goto(route.visitPath, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveScreenshot(snapshotName("assurance", route.route), {
        fullPage: true,
      });
    });
  }
});

