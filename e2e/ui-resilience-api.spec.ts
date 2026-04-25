/**
 * Resilience when status JSON is invalid or the request is aborted (no app-fixture 5xx coupling).
 */
import { test, expect } from "@playwright/test";
import { applyTheme } from "./fixtures/theme-fixture";

test.describe("@resilience external status — malformed response", () => {
  test.beforeEach(async ({ page }) => {
    await applyTheme(page, "light");
  });

  test("maps invalid JSON on status read to a visible error state", async ({ page }) => {
    await page.route("**/api/external-actions/**/status", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: "{ not json",
      });
    });
    await page.goto("/external/e2e-resilience-badjson", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "External response" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ui-alert-error")).toBeVisible();
  });

  test("aborted status request surfaces load error", async ({ page }) => {
    await page.route("**/api/external-actions/**/status", (route) => route.abort("failed"));
    await page.goto("/external/e2e-resilience-abort", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "External response" })).toBeVisible({ timeout: 20_000 });
  });

  test("empty 200 body still produces a recoverable error state", async ({ page }) => {
    await page.route("**/api/external-actions/**/status", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: "",
      });
    });
    await page.goto("/external/e2e-resilience-empty", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "External response" })).toBeVisible({ timeout: 20_000 });
  });
});
