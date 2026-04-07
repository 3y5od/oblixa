import { test, expect } from "@playwright/test";

test.describe("performance smoke", () => {
  test("home page loads within threshold", async ({ page }) => {
    const start = Date.now();
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test("login page loads within threshold", async ({ page }) => {
    const start = Date.now();
    await page.goto("/login");
    await expect(page.locator("h1")).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test("dashboard redirect path responds within threshold", async ({ page }) => {
    const start = Date.now();
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});

