import { test } from "./fixtures/app-fixture";
import { AuthPO } from "./page-objects/AuthPO";

test.describe("auth flow smoke", () => {
  test("dashboard unauthenticated access redirects to login", async ({ page }) => {
    const auth = new AuthPO(page);
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    await auth.expectLoginLoaded();
  });

  test("contracts unauthenticated access redirects to login", async ({ page }) => {
    const auth = new AuthPO(page);
    await page.goto("/contracts");
    await page.waitForURL(/\/login/);
    await auth.expectLoginLoaded();
  });
});

