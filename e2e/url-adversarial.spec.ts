/**
 * Adversarial URL query params on authenticated surfaces (Tier 1 plan traceability).
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=url_adversarial_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import owasp from "./fixtures/owasp-payloads.json";
import { surfaceTestIds } from "@/lib/qa/test-ids";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("URL adversarial (authenticated)", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  test("marketing root tolerates encoded XSS-like query from OWASP fixture", async ({ page }) => {
    const payload = owasp.xss[0];
    await page.goto(`/?q=${encodeURIComponent(payload)}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("contracts list tolerates negative page and huge limit in query", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.goto("/contracts?page=-1&limit=999999&sort=not-a-real-field", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Contracts$/i })).toBeVisible({ timeout: 25_000 });
    const tableOrEmpty = page
      .getByTestId(surfaceTestIds.contractsTable)
      .or(page.getByRole("status", { name: /Contracts empty state|Filtered contracts empty state/i }));
    await expect(tableOrEmpty).toBeVisible({ timeout: 25_000 });
  });
});
