/**
 * Authenticated matrix: query tampering, navigation smoke, and (when permitted) saved-view mutation.
 * Uses page objects + app fixture. Role expectations are data-driven via E2E_ROLE_LABEL when set.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=credential_gated_e2e_workflow_matrix
import { test, expect } from "./fixtures/app-fixture";
import { AuthPO } from "./page-objects/AuthPO";
import { ContractsPO } from "./page-objects/ContractsPO";
import { DashboardPO } from "./page-objects/DashboardPO";
import { WorkQueuePO } from "./page-objects/WorkQueuePO";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const E2E_ROLE_LABEL = (process.env.E2E_ROLE_LABEL || "").trim();

test.describe("auth workflow matrix", () => {
  test("login page renders (AuthPO)", async ({ page }) => {
    const auth = new AuthPO(page);
    await auth.gotoLogin();
    await auth.expectLoginLoaded();
  });

  test("forgot-password page responds without throwing (enumeration-neutral surface)", async ({ page }) => {
    const r = await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    if (r?.status() === 404) {
      test.skip(true, "/forgot-password not routed in this build.");
      return;
    }
    expect(r?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("query tampering: work + dashboard tolerate junk params", async ({ page, app }) => {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
    await app.loginAsDefaultUser();
    for (const path of [
      "/work?offset=-5&status=__proto__&foo=<script>1</script>",
      "/dashboard?tab=not-a-tab&n=1e10",
    ] as const) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        test.skip(true, `Route not available: ${path}`);
        return;
      }
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("contracts + work queue list shells load (PO)", async ({ page, app }) => {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
    await app.loginAsDefaultUser();
    const contracts = new ContractsPO(page);
    const work = new WorkQueuePO(page);
    await contracts.goto();
    await contracts.expectLoaded();
    await work.goto();
    await work.expectLoaded();
  });

  test("role label annotation (opt-in E2E_ROLE_LABEL)", async ({ page, app }) => {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
    await app.loginAsDefaultUser();
    const dash = new DashboardPO(page);
    await dash.goto();
    await dash.expectLoaded();
    if (E2E_ROLE_LABEL) {
      test.info().annotations.push({ type: "e2e-role", description: E2E_ROLE_LABEL });
    }
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible();
  });

  test("saved view mutation: save current filters when form is available", async ({ page, app }) => {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
    await app.loginAsDefaultUser();
    await page.goto("/contracts?sort=title", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Contracts$/i })).toBeVisible({ timeout: 30_000 });

    const nameInput = page.getByLabel(/save current view/i);
    if ((await nameInput.count()) === 0) {
      test.skip(true, "Saved view form not present (may lack edit permission).");
      return;
    }
    const name = `E2E matrix ${Date.now()}`;
    await nameInput.fill(name);
    await page.getByRole("button", { name: /^save view$/i }).click();
    await expect(page.getByRole("button", { name: /^save view$/i })).not.toContainText("Saving", {
      timeout: 25_000,
    });
    const inlineErr = page.locator("#saved-view-error");
    const hadError = (await inlineErr.count()) > 0 && (await inlineErr.isVisible().catch(() => false));
    expect(hadError, "if mutation failed, should show inline recoverable error").toBeFalsy();
  });
});
