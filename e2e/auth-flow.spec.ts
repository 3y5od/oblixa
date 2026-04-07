import { test, expect } from "@playwright/test";

test.describe("auth flow smoke", () => {
  test("dashboard unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("contracts unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/contracts");
    await page.waitForURL(/\/login/);
    await expect(page.locator("h1")).toBeVisible();
  });
});

