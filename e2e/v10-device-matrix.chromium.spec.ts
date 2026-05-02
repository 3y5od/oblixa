/**
 * @see v10-device-matrix.webkit.spec.ts, v10-device-matrix.firefox.spec.ts
 * Run matrix: PLAYWRIGHT_V10_MATRIX=1 E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e:v10:matrix
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=v10_device_matrix_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import { devices } from "@playwright/test";

const matrix = process.env.PLAYWRIGHT_V10_MATRIX === "1" || process.env.PLAYWRIGHT_V10_MATRIX === "true";
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.skip(!matrix || !E2E_EMAIL || !E2E_PASSWORD, "Set PLAYWRIGHT_V10_MATRIX=1 and E2E_TEST_EMAIL / E2E_TEST_PASSWORD");

test.use({
  ...devices["Desktop Chrome"],
  locale: "en-US",
  viewport: { width: 1440, height: 900 },
});

test.describe("@v10 V10 device matrix (chromium desktop)", () => {
  test("dashboard shell on chromium desktop", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Daily brief/i)).toBeVisible({ timeout: 25_000 });
  });
});
