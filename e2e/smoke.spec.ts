import { test, expect } from "@playwright/test";
import { GENERATED_PUBLIC_MULTI_BROWSER_PATHS } from "@/lib/qa/generated-route-matrices";
import { settleWebKitWorker } from "./fixtures/webkit-worker-teardown";

test.describe("public pages", () => {
  test.afterAll(async ({}, testInfo) => {
    await settleWebKitWorker(testInfo);
  });

  test.afterEach(async ({ page }) => {
    if (!page.isClosed()) {
      await page.close({ runBeforeUnload: false });
    }
  });

  for (const path of GENERATED_PUBLIC_MULTI_BROWSER_PATHS) {
    test(`${path} loads`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
    });
  }
});
