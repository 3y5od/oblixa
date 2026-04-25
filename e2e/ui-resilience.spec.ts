/**
 * Client resilience when critical reads fail (unauthenticated; avoids app-fixture 5xx coupling to external status).
 */
import { test, expect } from "@playwright/test";
import { applyTheme } from "./fixtures/theme-fixture";

test.describe("@resilience external status fetch", () => {
  test.beforeEach(async ({ page }) => {
    await applyTheme(page, "light");
  });

  test("maps HTTP 500 on status read to a visible recovery message", async ({ page }) => {
    await page.route("**/api/external-actions/**/status", async (route) => {
      await route.fulfill({
        status: 500,
        headers: { "Content-Type": "text/plain" },
        body: "Internal Server Error",
      });
    });

    await page.goto("/external/e2e-resilience-token", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "External response" })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator(".ui-alert-error").filter({ hasText: /Internal Server Error|Something went wrong on our end/i }),
    ).toBeVisible();
  });

  test("maps HTTP 429 on status read to a visible message", async ({ page }) => {
    await page.route("**/api/external-actions/**/status", async (route) => {
      await route.fulfill({
        status: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Too many requests. Try again shortly." }),
      });
    });

    await page.goto("/external/e2e-resilience-token-429", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "External response" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Too many requests/i)).toBeVisible();
  });
});
