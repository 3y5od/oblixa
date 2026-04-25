import { test, expect } from "./fixtures/app-fixture";

test.describe("a11y forms", () => {
  test("login form exposes accessible email and password fields", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("signup form exposes accessible fields", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  });

  test("forgot-password form exposes email field", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  });
});

