/**
 * Optional visual proxy (§8.4 / §26) — skipped unless PLAYWRIGHT_VISUAL_AUTH=1.
 * Non-blocking: does not run in default CI.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=compatibility_visual_optional_env_gated
import { test, expect } from "./fixtures/app-fixture";
import { snapshotName } from "./visual-helpers";
import type { Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const visual = process.env.PLAYWRIGHT_VISUAL_AUTH === "1";

test.describe("@compatibility visual optional (dashboard/contracts/review/work shell)", () => {
  test.skip(!visual, "Set PLAYWRIGHT_VISUAL_AUTH=1 to run visual subset.");
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated visual.");

  async function captureShell(page: Page, path: string, heading: RegExp) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 25_000 });
    await expect(page).toHaveScreenshot(snapshotName("compatibility-optional", path), {
      fullPage: true,
    });
  }

  test("@compatibility dashboard shell at 1280px", async ({ page, app }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await app.loginAsDefaultUser();
    await captureShell(page, "/dashboard", /^Dashboard$/i);
  });

  test("@compatibility contracts index shell at 1280px", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await captureShell(page, "/contracts", /^Contracts$/i);
  });

  test("@compatibility review queue shell at 1280px", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await captureShell(page, "/contracts/review", /^Review queue$/i);
  });

  test("@compatibility work queue shell at 1280px", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await captureShell(page, "/work", /^Work Queue$/i);
  });

  test("@compatibility reports shell at 1280px", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await captureShell(page, "/reports", /^Reports$/i);
  });

  test("@compatibility health shell at 1280px", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await captureShell(page, "/settings/health", /^System health$/i);
  });
});
