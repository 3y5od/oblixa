/**
 * @see current-product-device-matrix.chromium.spec.ts
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=current_product_device_matrix_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import { devices } from "@playwright/test";

const matrix =
  process.env.PLAYWRIGHT_DEVICE_MATRIX === "1" ||
  process.env.PLAYWRIGHT_DEVICE_MATRIX === "true" ||
  process.env.PLAYWRIGHT_V10_MATRIX === "1" ||
  process.env.PLAYWRIGHT_V10_MATRIX === "true";
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.skip(!matrix || !E2E_EMAIL || !E2E_PASSWORD, "Set PLAYWRIGHT_DEVICE_MATRIX=1 and E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

test.use({
  ...devices["Desktop Firefox"],
  locale: "en-GB",
  viewport: { width: 1280, height: 720 },
});

test.describe("@current-product current product device matrix (firefox desktop)", () => {
  test("work inbox on firefox desktop en-GB", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Daily action inbox/i)).toBeVisible({ timeout: 25_000 });
  });
});
