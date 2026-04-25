/**
 * Tier 9 — RTL layout + long-string spot check on public page (harness-level; not full i18n).
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=rtl_spot_smoke
import { test, expect } from "@playwright/test";

test.describe("IME / pseudo-locale / RTL", () => {
  test("privacy page: dir=rtl does not remove primary heading", async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.setAttribute("dir", "rtl");
      document.documentElement.setAttribute("lang", "ar");
    });
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    const long = "و".repeat(400);
    await page.evaluate((t) => {
      const h1 = document.querySelector("h1");
      if (h1) h1.textContent = t;
    }, long);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
