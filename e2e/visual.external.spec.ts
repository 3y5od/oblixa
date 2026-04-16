import { test, expect } from "./fixtures/app-fixture";
import { VISUAL_ENABLED, snapshotName } from "./visual-helpers";

test.describe("visual external surfaces", () => {
  test.skip(!VISUAL_ENABLED, "Set PLAYWRIGHT_VISUAL=1 to run screenshot baselines.");

  test("invalid token surface matches baseline", async ({ page }) => {
    await page.goto("/external/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveScreenshot(snapshotName("external", "/external/[token]"), {
      fullPage: true,
    });
  });
});

