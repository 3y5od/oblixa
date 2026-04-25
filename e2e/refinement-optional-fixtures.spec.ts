/**
 * Optional multi-workspace E2E (product-surface policy §12 / §14 / §10.4).
 * Skips when env is unset so default CI stays unchanged.
 */
import { test, expect } from "@playwright/test";
import { REFINEMENT_S10_4_UTILITY_PATHS } from "./authenticated-a11y-paths";
import { loginWithCredentials } from "./login-test-user";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=optional_multi_workspace_fixtures

const ADV_EMAIL = process.env.E2E_ADVANCED_EMAIL;
const ADV_PASSWORD = process.env.E2E_ADVANCED_PASSWORD;
const ASM_EMAIL = process.env.E2E_ASSURANCE_EMAIL;
const ASM_PASSWORD = process.env.E2E_ASSURANCE_PASSWORD;
const NON_ADMIN_EMAIL = process.env.E2E_CORE_NON_ADMIN_EMAIL;
const NON_ADMIN_PASSWORD = process.env.E2E_CORE_NON_ADMIN_PASSWORD;
const HIDDEN_ADV_EMAIL = process.env.E2E_HIDDEN_ADV_EMAIL;
const HIDDEN_ADV_PASSWORD = process.env.E2E_HIDDEN_ADV_PASSWORD;
const HIDDEN_ASM_EMAIL = process.env.E2E_HIDDEN_ASM_EMAIL;
const HIDDEN_ASM_PASSWORD = process.env.E2E_HIDDEN_ASM_PASSWORD;

test.describe("optional Advanced workspace fixture", () => {
  test.skip(!ADV_EMAIL || !ADV_PASSWORD, "Set E2E_ADVANCED_EMAIL and E2E_ADVANCED_PASSWORD to run.");

  test("§12.2 primary nav exposes at least one Advanced manager surface", async ({ page }) => {
    await loginWithCredentials(page, ADV_EMAIL!, ADV_PASSWORD!);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const primary = page.getByTestId("primary-nav");
    const decisions = await primary.getByRole("link", { name: /^Decisions$/ }).count();
    const campaigns = await primary.getByRole("link", { name: /^Campaigns$/ }).count();
    const programs = await primary.getByRole("link", { name: /^Programs$/ }).count();
    expect(decisions + campaigns + programs, "Expected Decisions, Campaigns, or Programs in primary nav").toBeGreaterThan(
      0
    );
  });

  test("V8 §14.4 Advanced workspace does not surface Assurance-only primary nav", async ({ page }) => {
    await loginWithCredentials(page, ADV_EMAIL!, ADV_PASSWORD!);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const primary = page.getByTestId("primary-nav");
    await expect(primary.getByRole("link", { name: /^Assurance$/ })).toHaveCount(0);

    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+KeyK`);
    const dlg = page.getByRole("dialog", { name: /command palette/i });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("link", { name: /^Assurance$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("§14 contextual smoke: renewals may surface decision CTA when Advanced module is visible", async ({
    page,
  }) => {
    await loginWithCredentials(page, ADV_EMAIL!, ADV_PASSWORD!);
    const resp = await page.goto("/contracts/renewals", { waitUntil: "domcontentloaded" });
    if (resp?.status() === 404) {
      test.skip(true, "Renewals route not available for this fixture.");
      return;
    }
    const openDecisions = page.getByRole("link", { name: /open decisions/i });
    const n = await openDecisions.count();
    if (n === 0) {
      test.skip(true, "No Open decisions CTA (module hidden or empty renewals); non-flaky skip.");
      return;
    }
    await expect(openDecisions.first()).toBeVisible();
  });
});

test.describe("optional Assurance workspace fixture", () => {
  test.skip(!ASM_EMAIL || !ASM_PASSWORD, "Set E2E_ASSURANCE_EMAIL and E2E_ASSURANCE_PASSWORD to run.");

  test("top-level Assurance link appears in primary nav", async ({ page }) => {
    await loginWithCredentials(page, ASM_EMAIL!, ASM_PASSWORD!);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const primary = page.getByTestId("primary-nav");
    await expect(primary.getByRole("link", { name: /^Assurance$/ })).toHaveCount(1);
  });
});

test.describe("optional Core non-admin fixture (§10.4 utilities redirect)", () => {
  test.skip(!NON_ADMIN_EMAIL || !NON_ADMIN_PASSWORD, "Set E2E_CORE_NON_ADMIN_EMAIL and E2E_CORE_NON_ADMIN_PASSWORD.");

  test("utility deep links redirect to dashboard for non-admin Core (or 404)", async ({ page }) => {
    await loginWithCredentials(page, NON_ADMIN_EMAIL!, NON_ADMIN_PASSWORD!);
    for (const path of REFINEMENT_S10_4_UTILITY_PATHS) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (resp?.status() === 404) {
        continue;
      }
      await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
    }
  });
});

test.describe("optional hidden Advanced module fixture", () => {
  test.skip(
    !HIDDEN_ADV_EMAIL || !HIDDEN_ADV_PASSWORD,
    "Set E2E_HIDDEN_ADV_EMAIL and E2E_HIDDEN_ADV_PASSWORD to run."
  );

  test("hidden Advanced deep-link is denied (403 or dashboard redirect)", async ({ page }) => {
    await loginWithCredentials(page, HIDDEN_ADV_EMAIL!, HIDDEN_ADV_PASSWORD!);
    const path = process.env.E2E_HIDDEN_ADV_PATH?.trim() || "/decisions";
    const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
    if (resp?.status() === 403 || resp?.status() === 404) {
      expect([403, 404]).toContain(resp?.status() ?? 0);
      return;
    }
    await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
  });

  test("primary nav, cmd-K, and /more omit configured hidden Advanced primary link", async ({ page }) => {
    const label =
      (process.env.E2E_HIDDEN_ADV_PRIMARY_EXCLUDE?.trim() && new RegExp(
        `^${process.env.E2E_HIDDEN_ADV_PRIMARY_EXCLUDE.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      )) || /^Decisions$/;
    await loginWithCredentials(page, HIDDEN_ADV_EMAIL!, HIDDEN_ADV_PASSWORD!);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const primary = page.getByTestId("primary-nav");
    await expect(primary.getByRole("link", { name: label })).toHaveCount(0);

    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+KeyK`);
    const dlg = page.getByRole("dialog", { name: /command palette/i });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("link", { name: label })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/more", { waitUntil: "domcontentloaded" });
    const main = page.locator("#main-content");
    await expect(main.getByRole("link", { name: label })).toHaveCount(0);
  });
});

test.describe("optional hidden Assurance module fixture", () => {
  test.skip(
    !HIDDEN_ASM_EMAIL || !HIDDEN_ASM_PASSWORD,
    "Set E2E_HIDDEN_ASM_EMAIL and E2E_HIDDEN_ASM_PASSWORD to run."
  );

  test("hidden Assurance deep-link is denied (403 or dashboard redirect)", async ({ page }) => {
    await loginWithCredentials(page, HIDDEN_ASM_EMAIL!, HIDDEN_ASM_PASSWORD!);
    const path = process.env.E2E_HIDDEN_ASM_PATH?.trim() || "/assurance/findings";
    const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
    if (resp?.status() === 403 || resp?.status() === 404) {
      expect([403, 404]).toContain(resp?.status() ?? 0);
      return;
    }
    await expect(page).toHaveURL(/\/dashboard\/?($|\?)/, { timeout: 15_000 });
  });

  test("primary nav, cmd-K, and /more omit configured hidden Assurance primary link", async ({ page }) => {
    const label =
      (process.env.E2E_HIDDEN_ASM_PRIMARY_EXCLUDE?.trim() && new RegExp(
        `^${process.env.E2E_HIDDEN_ASM_PRIMARY_EXCLUDE.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      )) || /^Assurance$/;
    await loginWithCredentials(page, HIDDEN_ASM_EMAIL!, HIDDEN_ASM_PASSWORD!);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Dashboard$/i })).toBeVisible({ timeout: 20_000 });
    const primary = page.getByTestId("primary-nav");
    await expect(primary.getByRole("link", { name: label })).toHaveCount(0);

    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+KeyK`);
    const dlg = page.getByRole("dialog", { name: /command palette/i });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("link", { name: label })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/more", { waitUntil: "domcontentloaded" });
    const main = page.locator("#main-content");
    await expect(main.getByRole("link", { name: label })).toHaveCount(0);
  });
});
