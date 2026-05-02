import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=wcag22_matrix_optional

test.describe("WCAG 2.2 spot checks", () => {
  test("skip link is focusable on home when present", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const skip = page.getByRole("link", { name: /skip to main content/i });
    if ((await skip.count()) === 0) {
      test.skip(true, "No skip link on this marketing shell.");
      return;
    }
    await skip.focus();
    await expect(skip).toBeFocused();
  });

  test("primary control on login has minimum box (heuristic)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const submit = page.locator("button[type='submit']").first();
    const box = await submit.boundingBox();
    if (!box) {
      test.skip(true, "Submit button not visible");
      return;
    }
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test("root layout survives doubled root font size (text zoom heuristic)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect(page.locator("body")).toBeVisible();
    const main = page.getByRole("main");
    if ((await main.count()) > 0) {
      await expect(main).toBeVisible();
    }
  });
});
