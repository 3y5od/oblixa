import { test, expect } from "./fixtures/app-fixture";

test.describe("a11y dialogs", () => {
  test("auth flow exposes expected heading after redirect dialog-free login guard", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

