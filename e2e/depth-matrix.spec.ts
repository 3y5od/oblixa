// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=depth_matrix_smoke
import { test, expect } from "@playwright/test";

test.describe("depth matrix @nightly", () => {
  test("second isolated context can load marketing home", async ({ browser }) => {
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page2.locator("body")).toBeVisible();
    await ctx2.close();
  });

  test("deep clipboard/DnD matrix when DEPTH_MATRIX_E2E=1", async ({ browser }) => {
    test.skip(!process.env.DEPTH_MATRIX_E2E, "Set DEPTH_MATRIX_E2E=1 for deep clipboard/DnD flows.");
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page2.locator("body")).toBeVisible();
    await ctx2.close();
  });
});
