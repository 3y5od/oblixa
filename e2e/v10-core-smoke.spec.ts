/**
 * V10 §6 browser-tier smoke: verifies the locally implemented V10 surfaces are
 * reachable and expose recoverable state without relying on RC fixture metrics.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=v10_core_smoke_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import { AppShellPO } from "./page-objects/AppShellPO";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("@v10 V10 core smoke", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
  test.describe.configure({ timeout: 120_000 });

  test("@v10 reaches daily brief, work index, command recovery, and settings governance", async ({ page, app }) => {
    await app.loginAsDefaultUser();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Exceptions and decisions requiring attention/i)).toBeVisible({ timeout: 25_000 });

    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Work Queue/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Workspace health/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Failed jobs/i }).first()).toBeVisible({ timeout: 10_000 });
    // Queue summary CTAs (e.g. Review approvals) live inside the closed <details> diagnostic panel.
    await page.getByText("Source queue diagnostics").click();
    await expect(page.getByRole("link", { name: /Review approvals/i }).first()).toBeVisible({ timeout: 10_000 });

    const shell = new AppShellPO(page);
    await shell.expectShellVisible();
    const headerSearch = shell.headerSearch();
    await headerSearch.focus();
    await headerSearch.fill("zzzz-v10-no-match");
    await headerSearch.press("Enter");
    await expect(shell.commandPalette()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Search contracts for this query/i })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    for (const surface of [
      { path: "/contracts/review", heading: /Review queue/i },
      { path: "/contracts/tasks", heading: /Task queue/i },
      { path: "/contracts/obligations", heading: /Obligations queue/i },
      { path: "/contracts/renewals", heading: /Renewals workspace/i },
      { path: "/contracts/bulk", heading: /Bulk import/i },
      { path: "/contracts/evidence-studio", heading: /Evidence studio/i },
      { path: "/contracts/approvals", heading: /Approvals & scenarios/i },
      { path: "/contracts/exceptions", heading: /Exception ledger/i },
      { path: "/contracts/reports", heading: /Digest run history|Reports history is disabled/i },
      { path: "/reports", heading: /Operational reports|Operations reports/i },
      { path: "/settings/health", heading: /System health/i },
    ]) {
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: surface.heading })).toBeVisible({ timeout: 20_000 });
    }

    await page.goto("/settings/product", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Product experience/i })).toBeVisible({ timeout: 20_000 });
    await page.goto("/contracts/tasks?status=blocked&team=__v10_empty_probe__", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-v10-state='empty']").first()).toBeVisible({ timeout: 20_000 });
  });

  test("@v10 mobile viewport: dashboard and system health remain usable", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Exceptions and decisions requiring attention|Critical signals/i).first()).toBeVisible({
      timeout: 25_000,
    });
    const openNavigation = page.getByRole("button", { name: /open navigation/i });
    await openNavigation.click();
    await expect(page.getByRole("dialog", { name: /navigation drawer/i })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /navigation drawer/i })).not.toBeVisible({ timeout: 5_000 });
    await expect(openNavigation).toBeFocused({ timeout: 5_000 });
    await page.goto("/settings/health", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /System health/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^Route health$/)).toBeVisible({ timeout: 15_000 });
  });

  test("@v10 keyboard: command palette closes with Escape and returns focus", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const shell = new AppShellPO(page);
    await shell.expectShellVisible();
    const headerSearch = shell.headerSearch();
    await headerSearch.focus();
    await headerSearch.fill("v10-keyboard-recovery");
    await headerSearch.press("Enter");
    await expect(shell.commandPalette()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(shell.commandPalette()).not.toBeVisible({ timeout: 5_000 });
  });
});

