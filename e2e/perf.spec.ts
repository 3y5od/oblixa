import { test, expect } from "@playwright/test";
import { loginWithCredentials } from "./login-test-user";

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

  test("privacy page loads within threshold", async ({ page }) => {
    const start = Date.now();
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test("terms page loads within threshold", async ({ page }) => {
    const start = Date.now();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test("cookies page loads within threshold", async ({ page }) => {
    const start = Date.now();
    await page.goto("/cookies");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test("authenticated dashboard shell visible within threshold", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL?.trim();
    const password = process.env.E2E_TEST_PASSWORD?.trim();
    test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated perf smoke.");
    const start = Date.now();
    await loginWithCredentials(page, email!, password!);
    await expect(page.getByRole("main")).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(25_000);
  });
});

