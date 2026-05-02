import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=en301549_508_optional

test.describe("EN 301 549 / 508 spot checks", () => {
  test("login submit control has accessible name (not icon-only)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const submit = page.locator("button[type='submit']").first();
    const name = await submit.getAttribute("aria-label");
    const text = await submit.textContent();
    expect(Boolean((name && name.trim().length > 0) || (text && text.trim().length > 0))).toBeTruthy();
  });
});
