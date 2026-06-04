/**
 * Compatibility proxy — minimal authenticated paths tagged for `npm run test:e2e -- --grep @compatibility`.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=compatibility_core_smoke_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import { AppShellPO } from "./page-objects/AppShellPO";
import { ContractsPO } from "./page-objects/ContractsPO";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const PRIVATE_PRODUCT_CONTROLS = process.env.OBLIXA_ENABLE_PRIVATE_PRODUCT_CONTROLS === "1";

test.describe("@compatibility compatibility core smoke", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
  test.describe.configure({ timeout: 120_000 });

  test("@compatibility reaches dashboard, header search, contracts, and core workflow hubs", async ({ page, app }) => {
    await app.loginAsDefaultUser();

    for (const width of [768, 1024, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Contract tracking/i })).toBeVisible({ timeout: 25_000 });

      const contracts = new ContractsPO(page);
      await contracts.goto();
      await contracts.expectLoaded();

      const shell = new AppShellPO(page);
      await expect(shell.mainContent()).toBeVisible();
      if (width >= 1024) {
        await expect(shell.primaryNav()).toBeVisible({ timeout: 10_000 });
      } else {
        await expect(page.getByRole("button", { name: /Open navigation/i })).toBeVisible({ timeout: 10_000 });
        await shell.openMobileNavigation();
        await page.keyboard.press("Escape");
        await expect(shell.mobileDrawer()).not.toBeVisible({ timeout: 5_000 });
      }
      const headerSearch = shell.headerSearch();
      await expect(headerSearch).toBeVisible({ timeout: 10_000 });
      await headerSearch.fill("review");
      await headerSearch.press("Enter");
      await expect(page).toHaveURL(/\/search\?q=review/);
      await expect(page.getByRole("link", { name: /Review fields/i })).toBeVisible({ timeout: 10_000 });
      await shell.openCommandPalette();
      await shell.commandPaletteInput().fill("compatibility-nomatch-query");
      await expect(
        page.getByRole("link", { name: /Search contracts: compatibility-nomatch-query/i })
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("link", { name: /Open full search/i })).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");

      await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });

      await page.goto("/work", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Work$/i }).first()).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/renewals", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Renewals$/i }).first()).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/exceptions", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Exception ledger/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/evidence-studio", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Evidence$/i }).first()).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/review", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Review fields/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/bulk", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Import contracts/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/reports", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Reports$/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("link", { name: /Export upcoming renewals/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/data-quality", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Data quality/i })).toBeVisible({ timeout: 20_000 });

      await page.goto("/contracts/reports", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /^Reports$/i }).first()).toBeVisible({ timeout: 20_000 });

      if (PRIVATE_PRODUCT_CONTROLS) {
        await page.goto("/settings/product", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: /Product experience/i })).toBeVisible({ timeout: 20_000 });
      }

      await page.goto("/settings/health", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /System health/i })).toBeVisible({ timeout: 20_000 });
    }
  });
});
