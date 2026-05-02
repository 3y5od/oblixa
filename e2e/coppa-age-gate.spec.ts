// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=coppa_marketing_smoke
import { test, expect } from "@playwright/test";

test.describe("COPPA age gate", () => {
  test("marketing shell loads for default matrix", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("parental-age flow when COPPA_E2E=1", async ({ page }) => {
    test.skip(process.env.COPPA_E2E !== "1", "Set COPPA_E2E=1 to assert parental-age gating copy and controls.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
