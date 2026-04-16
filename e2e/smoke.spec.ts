import { test, expect } from "@playwright/test";
import { GENERATED_PUBLIC_MULTI_BROWSER_PATHS } from "@/lib/qa/generated-route-matrices";

test.describe("public pages", () => {
  for (const path of GENERATED_PUBLIC_MULTI_BROWSER_PATHS) {
    test(`${path} loads`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
    });
  }
});
