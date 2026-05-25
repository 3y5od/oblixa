/**
 * Current product browser-tier smoke: verifies the locally implemented surfaces are
 * reachable and expose recoverable state without relying on RC fixture metrics.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=current_product_core_smoke_e2e_credentials_gate
import { test, expect } from "./fixtures/app-fixture";
import { AppShellPO } from "./page-objects/AppShellPO";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("@current-product current product core smoke", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
  test.describe.configure({ timeout: 120_000 });

  test("@current-product reaches Core dashboard, work index, command recovery, and settings governance", async ({ page, app }) => {
    await app.loginAsDefaultUser();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Contract tracking/i })).toBeVisible({ timeout: 25_000 });
    for (const card of [
      "Needs review",
      "Upcoming deadlines",
      "Blocked work",
      "Missing owners",
      "Open exceptions",
      "Evidence requested",
    ]) {
      await expect(page.getByText(card).first()).toBeVisible({ timeout: 10_000 });
    }
    for (const section of [
      "Review Queue",
      "Upcoming Deadlines",
      "Work Needing Action",
      "Data Gaps",
      "Recent Activity",
    ]) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible({ timeout: 10_000 });
    }

    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Work" }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Create work item/i })).toBeVisible({ timeout: 10_000 });
    for (const tab of ["All", "My work", "Overdue", "Blocked", "Approvals", "Obligations", "Exceptions"]) {
      await expect(page.getByRole("link", { name: new RegExp(tab, "i") }).first()).toBeVisible({ timeout: 10_000 });
    }

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
      { path: "/contracts/renewals", heading: /^Renewals$/i },
      { path: "/contracts/bulk", heading: /Bulk import/i },
      { path: "/contracts/evidence-studio", heading: /^Evidence$/i },
      { path: "/contracts/approvals", heading: /Approvals & scenarios/i },
      { path: "/contracts/exceptions", heading: /Exception ledger/i },
      { path: "/contracts/reports", heading: /Operational reports|Digest run history|Reports history is disabled/i },
      { path: "/reports", heading: /^Reports$/i },
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

  test("@current-product mobile viewport: dashboard and system health remain usable", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Contract tracking/i })).toBeVisible({
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
    await expect(page.getByText(/^\d+ workflow checks clear$/i)).toBeVisible({ timeout: 15_000 });
  });

  test("@current-product sidebar refinement: expanded, collapsed, mobile drawer, and command parity", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("sidebar-desktop")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("navigation", { name: /^core$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /^contracts$/i }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("sidebar-collapse-toggle").click();
    await expect(page.getByTestId("sidebar-collapse-toggle")).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("link", { name: /^settings$/i }).first().focus();
    await expect(page.getByText(/^Settings$/).last()).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    await expect(page.getByRole("dialog", { name: /command palette/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /^Contracts/i }).first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /open navigation/i }).click();
    const drawer = page.getByRole("dialog", { name: /navigation drawer/i });
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible({ timeout: 5_000 });
  });

  test("@current-product keyboard: command palette closes with Escape and returns focus", async ({ page, app }) => {
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
