/**
 * @see v10-device-matrix.chromium.spec.ts
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=v10_device_matrix_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import { devices } from "@playwright/test";

const matrix = process.env.PLAYWRIGHT_V10_MATRIX === "1" || process.env.PLAYWRIGHT_V10_MATRIX === "true";
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.skip(!matrix || !E2E_EMAIL || !E2E_PASSWORD, "Set PLAYWRIGHT_V10_MATRIX=1 and E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

test.use({
  ...devices["iPhone 13"],
  locale: "en-US",
});

test.describe("@v10 V10 device matrix (webkit mobile)", () => {
  test("dashboard brief on webkit mobile reduced motion", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Daily brief/i)).toBeVisible({ timeout: 25_000 });
  });
});
