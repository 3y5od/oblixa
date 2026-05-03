/**
 * Adversarial URL query params on authenticated surfaces (Tier 1 plan traceability).
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=url_adversarial_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import type { Page } from "@playwright/test";
import owasp from "./fixtures/owasp-payloads.json";
import { surfaceTestIds } from "@/lib/qa/test-ids";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

/** Blocking first-run calibration can intercept /contracts; minimal setup matches other smoke tests. */
async function dismissBlockingCalibrationIfPresent(page: Page) {
  const skip = page.getByRole("button", { name: /Skip questionnaire \(minimal setup\)/i });
  try {
    await skip.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    return;
  }
  await skip.click({ force: true });
  await expect(page.getByRole("heading", { name: /What do you mainly want to do in Oblixa right now/i })).not.toBeVisible({
    timeout: 45_000,
  });
}

test.describe("URL adversarial (authenticated)", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  test("marketing root tolerates encoded XSS-like query from OWASP fixture", async ({ page }) => {
    const payload = owasp.xss[0];
    await page.goto(`/?q=${encodeURIComponent(payload)}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("contracts list tolerates negative page and huge limit in query", async ({ page, app }) => {
    test.setTimeout(120_000);
    await app.loginAsDefaultUser();
    await dismissBlockingCalibrationIfPresent(page);
    await page.goto("/contracts?page=-1&limit=999999&sort=not-a-real-field", { waitUntil: "domcontentloaded" });
    await dismissBlockingCalibrationIfPresent(page);
    const contractsHeading = page.getByRole("heading", { level: 1, name: /^Contracts$/i });
    await expect(contractsHeading).toBeVisible({ timeout: 90_000 });
    const tableOrEmpty = page
      .getByTestId(surfaceTestIds.contractsTable)
      .or(page.getByRole("status", { name: /Contracts empty state|Filtered contracts empty state/i }));
    await expect(tableOrEmpty).toBeVisible({ timeout: 30_000 });
  });
});
