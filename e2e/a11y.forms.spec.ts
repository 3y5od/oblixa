import { test, expect } from "./fixtures/app-fixture";

test.describe("a11y forms", () => {
  test("login form exposes accessible email and password fields", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });
});

