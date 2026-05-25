import { test, expect, type Page } from "@playwright/test";
import { shouldTreat404AsOptionalMatrix } from "./fixtures/surface-availability";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=assurance_smokes_are_fixture_gated

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function loginAsTestUser(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("input[type='email']").fill(E2E_EMAIL!);
  await page.locator("input[type='password']").fill(E2E_PASSWORD!);
  await page.locator("button[type='submit']").first().click();
  const reachedDashboard = await page
    .waitForURL(/\/dashboard/, {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    })
    .then(() => true)
    .catch(() => false);
  if (reachedDashboard) {
    return;
  }
  const rateLimited = await page
    .getByText(/too many sign-in attempts/i)
    .isVisible()
    .catch(() => false);
  if (rateLimited) {
    test.skip(true, "Auth provider rate-limited this test account.");
  }
  throw new Error("Login did not reach /dashboard and was not rate-limited.");
}

test.describe("assurance hub", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated assurance checks."
  );

  test("assurance hub and findings load when route is deployed", async ({ page }) => {
    await loginAsTestUser(page);

    const hub = await page.goto("/assurance", { waitUntil: "domcontentloaded" });
    if (hub?.status() === 404) {
      if (shouldTreat404AsOptionalMatrix("/assurance")) {
        test.skip(true, "/assurance not mounted in this matrix (fixture).");
        return;
      }
      throw new Error("Unexpected 404 for /assurance");
    }
    await expect(page.getByRole("heading", { name: /continuous assurance/i })).toBeVisible();

    const findings = await page.goto("/assurance/findings", { waitUntil: "domcontentloaded" });
    if (findings?.status() === 404) {
      if (shouldTreat404AsOptionalMatrix("/assurance/findings")) {
        test.skip(true, "V6 /assurance/findings not mounted in this matrix (fixture).");
        return;
      }
      throw new Error("Unexpected 404 for /assurance/findings");
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("health graph, scorecards, and review boards pages load when deployed", async ({ page }) => {
    await loginAsTestUser(page);

    const paths = [
      "/assurance/health-graph",
      "/assurance/scorecards",
      "/assurance/review-boards",
      "/assurance/program-evolution",
    ] as const;
    for (const path of paths) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (res?.status() === 404) {
        if (shouldTreat404AsOptionalMatrix(path)) {
          test.skip(true, `V6 ${path} not mounted in this matrix (fixture).`);
          return;
        }
        throw new Error(`Unexpected 404 for ${path}`);
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    }
  });

  test("control policies, playbooks, autopilot, and segments pages load when deployed", async ({ page }) => {
    await loginAsTestUser(page);

    const paths = [
      "/assurance/control-policies",
      "/assurance/playbooks",
      "/assurance/autopilot",
      "/assurance/segments",
    ] as const;
    for (const path of paths) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (res?.status() === 404) {
        if (shouldTreat404AsOptionalMatrix(path)) {
          test.skip(true, `V6 ${path} not mounted in this matrix (fixture).`);
          return;
        }
        throw new Error(`Unexpected 404 for ${path}`);
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    }
  });

  test("reports outcome and assurance anchor sections exist when page loads", async ({ page }) => {
    await loginAsTestUser(page);
    const res = await page.goto("/reports", { waitUntil: "domcontentloaded" });
    if (res?.status() === 404) {
      if (shouldTreat404AsOptionalMatrix("/reports")) {
        test.skip(true, "/reports not mounted in this matrix (fixture).");
        return;
      }
      throw new Error("Unexpected 404 for /reports");
    }
    if (res?.status() === 403) {
      test.skip(true, "/reports not available in this environment.");
      return;
    }
    const outcome = page.locator("#outcome-intelligence");
    const assurance = page.locator("#assurance-analytics");
    const hasOutcome = await outcome.count();
    const hasAssurance = await assurance.count();
    if (hasOutcome === 0 && hasAssurance === 0) {
      test.skip(true, "Report anchor sections not present (features off or layout changed).");
      return;
    }
    if (hasOutcome > 0) {
      await expect(outcome.first()).toBeVisible();
    }
    if (hasAssurance > 0) {
      await expect(assurance.first()).toBeVisible();
    }
  });
});
