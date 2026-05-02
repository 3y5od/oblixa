import { test, expect } from "@playwright/test";
import { loginWithCredentials } from "./login-test-user";
import { GENERATED_PUBLIC_A11Y_PATHS } from "@/lib/qa/generated-route-matrices";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=perf_checks_require_optional_auth_fixtures

test.describe("performance smoke", () => {
  for (const path of GENERATED_PUBLIC_A11Y_PATHS.filter((value) =>
    ["/", "/login", "/privacy", "/terms", "/cookies"].includes(value)
  )) {
    test(`${path} loads within threshold`, async ({ page }) => {
      const start = Date.now();
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  }

  test("dashboard redirect path responds within threshold", async ({ page }) => {
    const start = Date.now();
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test("authenticated dashboard shell visible within threshold", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL?.trim();
    const password = process.env.E2E_TEST_PASSWORD?.trim();
    test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated perf smoke.");
    const start = Date.now();
    await loginWithCredentials(page, email!, password!);
    await expect(page.getByRole("main")).toBeVisible();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(25_000);
  });

  test("navigation timing entry exists for home (Web Vitals harness)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const nav = await page.evaluate(() => {
      const e = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return e ? { duration: e.duration, domContentLoaded: e.domContentLoadedEventEnd } : null;
    });
    if (!nav) {
      test.skip(true, "Navigation timing not exposed in this browser.");
      return;
    }
    expect(nav.duration).toBeGreaterThan(0);
    expect(nav.domContentLoaded).toBeGreaterThan(0);
  });
});

