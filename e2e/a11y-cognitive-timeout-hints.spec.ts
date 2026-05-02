import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=cognitive_timeout_optional

test.describe("session / timeout hints (marketing shell)", () => {
  test("login form is still visible after short idle (no immediate surprise redirect)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await expect(page.locator("body")).toBeVisible();
    const pwd = page.locator("input[type='password']").first();
    if ((await pwd.count()) > 0) {
      await expect(pwd).toBeVisible();
    }
  });
});
