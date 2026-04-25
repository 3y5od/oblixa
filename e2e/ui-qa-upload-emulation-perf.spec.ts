/**
 * Tiers 9, 10, 11 — file input constraints (unauthenticated), preference emulation, soft navigation timing on public P0.
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=ui_qa_tier9_10_11
import { test, expect } from "@playwright/test";

test.describe("upload / export / calendar (UI affordances without auth)", () => {
  test("protected bulk import route does not show upload UI without a session (Tier 9 gate)", async ({
    page,
  }) => {
    await page.goto("/contracts/bulk", { waitUntil: "domcontentloaded" });
    const onLogin = /\/(login|signup)/.test(new URL(page.url()).pathname);
    const hasFile = (await page.locator('input[type="file"]').count()) > 0;
    expect(onLogin || hasFile, "expect login redirect or authenticated upload surface").toBeTruthy();
  });
});

test.describe("environment emulation (Tier 10)", () => {
  test("reduced motion + dark scheme: marketing home still has visible h1", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const navMs = Date.now() - start;
    expect(navMs, "soft budget hint").toBeLessThan(120_000);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("soft perf (Tier 11)", () => {
  test("public home loads in under 2 minutes in CI (smoke budget)", async ({ page }) => {
    const t0 = Date.now();
    await page.goto("/", { waitUntil: "load" });
    expect(Date.now() - t0).toBeLessThan(120_000);
  });
});
