/**
 * @see current-product-device-matrix.webkit.spec.ts, current-product-device-matrix.firefox.spec.ts
 * Run matrix: PLAYWRIGHT_DEVICE_MATRIX=1 E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e:current-product:matrix
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
  ...devices["Desktop Chrome"],
  locale: "en-US",
  viewport: { width: 1440, height: 900 },
});

test.describe("@current-product current product device matrix (chromium desktop)", () => {
  test("dashboard shell on chromium desktop", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Contract tracking/i })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Needs review").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible({ timeout: 10_000 });
  });
});
