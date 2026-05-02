import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=font_cls_optional

test.describe("font / CLS heuristic", () => {
  test("computed font-family is defined on home body", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font.length).toBeGreaterThan(3);
  });
});
