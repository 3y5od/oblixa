import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=tab_order_audit_optional

test.describe("tab order / tabindex abuse", () => {
  test("home has no positive tabindex attributes", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const n = await page.locator("[tabindex]").count();
    if (n === 0) {
      expect(n).toBe(0);
      return;
    }
    for (let i = 0; i < n; i++) {
      const v = await page.locator("[tabindex]").nth(i).getAttribute("tabindex");
      const num = v ? Number.parseInt(v, 10) : 0;
      expect(num, `positive tabindex at index ${i}`).toBeLessThanOrEqual(0);
    }
  });
});
