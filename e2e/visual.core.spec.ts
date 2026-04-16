import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_AUTHENTICATED_ROUTES } from "./generated/authenticated-routes";
import { VISUAL_AUTH_ENABLED, snapshotName } from "./visual-helpers";
import { hasCoverage } from "@/lib/qa/generated-route-matrices";

test.describe("visual core surfaces", () => {
  test.skip(!VISUAL_AUTH_ENABLED, "Set PLAYWRIGHT_VISUAL=1 and PLAYWRIGHT_VISUAL_AUTH=1 for authenticated screenshots.");

  for (const route of GENERATED_AUTHENTICATED_ROUTES.filter(
    (entry) => hasCoverage(entry, "visual") && entry.workspaceModeTier === "core"
  )) {
    test(`${route.route} matches visual baseline`, async ({ page, app }) => {
      await app.loginAsDefaultUser();
      await page.goto(route.visitPath, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveScreenshot(snapshotName("core", route.route), {
        fullPage: true,
      });
    });
  }
});

