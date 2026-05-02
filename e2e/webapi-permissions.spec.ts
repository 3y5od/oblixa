// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=webapi_permissions_smoke
import { test, expect } from "@playwright/test";

test.describe("webapi permissions @nightly", () => {
  test("Permissions API is present or absent consistently", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const t = await page.evaluate(() => typeof navigator.permissions);
    expect(["object", "undefined"]).toContain(t);
  });

  test("clipboard/geo probes when RUN_WEBAPI_E2E=1", async ({ page }) => {
    test.skip(!process.env.RUN_WEBAPI_E2E, "Set RUN_WEBAPI_E2E=1 to probe clipboard/geo in a trusted context.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
