/**
 * Tier 30 / 61 — user-visible copy on status failures (no raw status codes in user strings), via client-json paths.
 * Uses public external page + network mock (mirrors ui-resilience patterns).
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=http_status_mocks
import { test, expect } from "@playwright/test";
import { applyTheme } from "./fixtures/theme-fixture";

test.describe("HTTP status UI (mocked) — external status route", () => {
  test.beforeEach(async ({ page }) => {
    await applyTheme(page, "light");
  });

  test("503+JSON error maps to user-visible text (not bare 503 in headline)", async ({ page }) => {
    await page.route("**/api/external-actions/**/status", async (route) => {
      await route.fulfill({
        status: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Service temporarily unavailable" }),
      });
    });
    await page.goto("/external/e2e-503-mock", { waitUntil: "domcontentloaded" });
    const err = page.locator(".ui-alert-error, [data-testid=external-submit-load-error]");
    await expect(err.first()).toBeVisible({ timeout: 20_000 });
    const t = (await err.first().textContent()) ?? "";
    expect(t, "user copy should not be only the string 503 in isolation").not.toMatch(/^\s*503\s*$/);
  });
});
