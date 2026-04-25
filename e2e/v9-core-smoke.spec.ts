/**
 * V9 §30 proxy — minimal authenticated paths tagged for `npm run test:e2e -- --grep @v9`.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=v9_core_smoke_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import { AppShellPO } from "./page-objects/AppShellPO";
import { ContractsPO } from "./page-objects/ContractsPO";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("@v9 V9 core smoke", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  test("@v9 reaches dashboard, header search, contracts, and core workflow hubs", async ({ page, app }) => {
    await app.loginAsDefaultUser();

    for (const width of [768, 1024, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 25_000 });

      const contracts = new ContractsPO(page);
      await contracts.goto();
      await contracts.expectLoaded();

      const shell = new AppShellPO(page);
      await shell.expectShellVisible();
      const headerSearch = shell.headerSearch();
      await expect(headerSearch).toBeVisible({ timeout: 10_000 });
      await headerSearch.fill("review");
      await headerSearch.press("Enter");
      await expect(shell.commandPalette()).toBeVisible({ timeout: 10_000 });
      const cmdkInput = page.getByPlaceholder(/search pages, queues, reports, or tools/i);
      await expect(page.getByRole("link", { name: /^Review$/i }).first()).toBeVisible({ timeout: 10_000 });
      await cmdkInput.fill("zzzz-no-match");
      await expect(page.getByText(/no matches found/i)).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");

      await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });

      await page.goto("/work", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Work Queue$/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/renewals", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Renewals workspace/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/exceptions", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Exception ledger/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/evidence-studio", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Evidence studio/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/review", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Review queue/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/bulk", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Bulk import/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/reports", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Operational reports/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/report delivery posture/i)).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/data-quality", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Data quality/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/reports", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: /Digest run history|Reports history is disabled/i }),
      ).toBeVisible({ timeout: 20_000 });

      await page.goto("/settings/product", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Product experience/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/settings/health", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /System health/i })).toBeVisible({ timeout: 20_000 });
    }
  });
});
