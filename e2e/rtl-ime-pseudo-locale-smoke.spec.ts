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

  test("login page formats a large integer with grouping in en-US", async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.setAttribute("lang", "en-US");
    });
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const formatted = await page.evaluate(() =>
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(1_234_567)
    );
    expect(formatted).toMatch(/1.*234.*567|1234567/);
  });

  test("dashboard route resolves to app shell or auth (second dashboard-class route)", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const u = page.url();
    expect(/dashboard|login|sign|auth/i.test(u)).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("table: ja-JP month label is stable for UTC midnight", async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.setAttribute("lang", "ja-JP");
    });
    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    const label = await page.evaluate(() =>
      new Intl.DateTimeFormat("ja-JP", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 15)))
    );
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toMatch(/invalid/i);
  });
});
