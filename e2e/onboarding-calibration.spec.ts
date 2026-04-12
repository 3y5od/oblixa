import { test, expect } from "@playwright/test";
import { loginWithCredentials } from "./login-test-user";

/**
 * Optional: E2E_ONBOARDING_BLOCKING=1 with blocking fixture org.
 * E2E_ONBOARDING_EXPORT=1 for product settings export download.
 * E2E_ONBOARDING_MUTATE=1 disposable org only — Apply recommendation / simpler / skip / settings.
 * E2E_CORE_NON_ADMIN_EMAIL + E2E_CORE_NON_ADMIN_PASSWORD — non-admin redirected from calibration.
 *
 * Describe titles include `@onboarding` for `npm run test:e2e:onboarding:grep`.
 */

const blocking =
  process.env.E2E_ONBOARDING_BLOCKING === "1" || process.env.E2E_ONBOARDING_BLOCKING === "true";
const exportSmoke =
  process.env.E2E_ONBOARDING_EXPORT === "1" || process.env.E2E_ONBOARDING_EXPORT === "true";
const mutate =
  process.env.E2E_ONBOARDING_MUTATE === "1" || process.env.E2E_ONBOARDING_MUTATE === "true";

test.describe("@onboarding calibration — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("GET /onboarding/calibration redirects to login", async ({ page }) => {
    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("@onboarding calibration — signed-in smoke", () => {
  test("empty state or wizard on /onboarding/calibration", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    const emptyCopy = page.getByText(/no questionnaire to complete/i);
    const stepCopy = page.getByText(/Step 1 of 9/i);
    const visibleEmpty = await emptyCopy.isVisible().catch(() => false);
    const visibleWizard = await stepCopy.isVisible().catch(() => false);
    expect(visibleEmpty || visibleWizard).toBe(true);
  });

  test("unknown onboarding child route is not 5xx", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    const res = await page.goto("/onboarding/not-a-real-child-route-oblixa", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("step 0 and review viewport overflow when wizard reaches review", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    const onWizard = await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false);
    test.skip(!onWizard, "Fixture not in active calibration wizard");

    await page.setViewportSize({ width: 390, height: 844 });
    let delta = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(delta, "step 0 horizontal overflow").toBeLessThanOrEqual(8);

    for (let i = 0; i < 7; i++) {
      const radios = page.locator('input[type="radio"]');
      const count = await radios.count();
      test.skip(count < 1, "No radio on step");
      await radios.first().click();
      await page.getByRole("button", { name: "Next" }).click();
    }
    await page.getByRole("button", { name: /Continue to review/i }).click();
    await expect(page.getByTestId("calibration-review-root")).toBeVisible({ timeout: 120_000 });

    delta = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(delta, "review horizontal overflow").toBeLessThanOrEqual(8);
  });

  test("resume deep link and reload when wizard active", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/onboarding/calibration?step=3", { waitUntil: "domcontentloaded" });
    const step4 = page.getByText(/Step 4 of 9/i);
    const empty = page.getByText(/no questionnaire to complete/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, "No active questionnaire for deep link");
    }
    await expect(step4).toBeVisible({ timeout: 30_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Step 4 of 9|Step 1 of 9/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test("Back returns to previous question when wizard active", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    const onWizard = await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false);
    test.skip(!onWizard, "Fixture not in active calibration wizard");

    await page.locator('input[type="radio"]').first().click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Step 2 of 9/i)).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText(/Step 1 of 9/i)).toBeVisible();
  });

  test("keyboard-only advance from step 0 when wizard active", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    const onWizard = await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false);
    test.skip(!onWizard, "Fixture not in active calibration wizard");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Step 2 of 9/i)).toBeVisible({ timeout: 15_000 });
  });

  test("preview-related POST budget when advancing one step (wizard active)", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    const onWizard = await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false);
    test.skip(!onWizard, "Fixture not in active calibration wizard");

    let posts = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/onboarding/calibration")) posts += 1;
    });

    await page.locator('input[type="radio"]').first().click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Step 2 of 9/i)).toBeVisible({ timeout: 30_000 });
    expect(posts, "server action posts for one step").toBeLessThanOrEqual(25);
  });
});

test.describe("@onboarding calibration — non-admin Core", () => {
  test("redirects to dashboard from calibration", async ({ page }) => {
    const email = process.env.E2E_CORE_NON_ADMIN_EMAIL;
    const password = process.env.E2E_CORE_NON_ADMIN_PASSWORD;
    test.skip(!email || !password, "E2E_CORE_NON_ADMIN_EMAIL / PASSWORD not set");
    await loginWithCredentials(page, email!, password!);
    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("onboarding calibration — optional logout", () => {
  test("sign out from calibration yields safe redirect (no 5xx)", async ({ page, context }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    const onWizard = await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false);
    test.skip(!onWizard, "Optional logout requires active wizard");

    await context.clearCookies();
    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/login|\/dashboard/);
  });
});

test.describe("@onboarding calibration — banner dismiss (optional)", () => {
  test("dismiss onboarding banner when visible", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    await loginWithCredentials(page, email!, password!);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const dismiss = page.getByRole("button", { name: /Dismiss|Got it|Complete setup/i });
    const visible = await dismiss.isVisible().catch(() => false);
    test.skip(!visible, "Onboarding banner not shown for fixture");
    await dismiss.click();
    await page.waitForTimeout(500);
    const err = page.getByRole("alert");
    expect(await err.isVisible().catch(() => false)).toBe(false);
  });
});

test.describe("@onboarding calibration gate", () => {
  test.skip(!blocking, "E2E_ONBOARDING_BLOCKING not enabled");
  test.describe.configure({ timeout: 90_000 });

  test("redirects authenticated admin to calibration until completed", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    if (!email || !password) return;

    await page.goto("/login");
    await page.locator("input[type='email']").fill(email);
    await page.locator("input[type='password']").fill(password);
    await page.locator("button[type='submit']").first().click();

    await page.waitForURL(/\/onboarding\/calibration|\/dashboard/);
    await expect(page).toHaveURL(/\/onboarding\/calibration/);

    await page.goto("/onboarding/calibration?step=3");
    await expect(page).toHaveURL(/\/onboarding\/calibration/);
    await expect(page.getByText(/Step 4 of 9/i)).toBeVisible();

    await page.goto("/onboarding/calibration");
    await page.waitForLoadState("networkidle");
    const stable = page.url();
    await page.waitForTimeout(400);
    expect(page.url()).toBe(stable);
  });
});

test.describe("@onboarding calibration recalibration", () => {
  test("admin can open review from settings and review fits narrow viewport", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    if (!email || !password) return;

    await page.goto("/login");
    await page.locator("input[type='email']").fill(email);
    await page.locator("input[type='password']").fill(password);
    await page.locator("button[type='submit']").first().click();
    await page.waitForURL(/\/dashboard|\/onboarding\/calibration/);

    await page.goto("/settings/product", { waitUntil: "domcontentloaded" });
    const runAgain = page.getByRole("button", { name: /Run calibration again/i });
    const hasRun = await runAgain.isVisible().catch(() => false);
    test.skip(!hasRun, "Run calibration again not available (non-admin or no calibration record)");

    await runAgain.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    if (!page.url().includes("/onboarding/calibration")) {
      test.skip(true, "Recalibration did not open (no calibration record on fixture org).");
    }

    await page.goto("/onboarding/calibration?step=8", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("calibration-review-root")).toBeVisible({ timeout: 25_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    const delta = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(delta, "calibration review horizontal overflow").toBeLessThanOrEqual(8);
  });
});

test.describe("@onboarding calibration export (optional)", () => {
  test.skip(!exportSmoke, "E2E_ONBOARDING_EXPORT not enabled");

  test("product settings export triggers download", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD required");
    if (!email || !password) return;

    await page.goto("/login");
    await page.locator("input[type='email']").fill(email);
    await page.locator("input[type='password']").fill(password);
    await page.locator("button[type='submit']").first().click();
    await page.waitForURL(/\/dashboard|\/onboarding\/calibration/);

    await page.goto("/settings/product");
    await page.waitForLoadState("networkidle");

    const exportBtn = page.getByRole("button", { name: /Export questionnaire JSON/i });
    const visible = await exportBtn.isVisible().catch(() => false);
    test.skip(!visible, "Export control not shown (no questionnaire record for fixture org)");

    const downloadPromise = page.waitForEvent("download");
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^onboarding-calibration-[a-f0-9]{8}-\d{8}T\d{6}Z\.json$/);
  });
});

test.describe("@onboarding calibration — mutating paths (disposable org only)", () => {
  test.skip(!mutate, "E2E_ONBOARDING_MUTATE not enabled");

  test("Start with simpler setup lands on dashboard", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "credentials required");
    await loginWithCredentials(page, email!, password!);
    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    test.skip(!(await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false)), "wizard not active");
    await page.getByRole("button", { name: /Start with simpler setup/i }).first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  });

  test("Skip questionnaire minimal lands on dashboard", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "credentials required");
    await loginWithCredentials(page, email!, password!);
    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    test.skip(!(await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false)), "wizard not active");
    await page.getByRole("button", { name: /Skip questionnaire \(minimal setup\)/i }).first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  });

  test("Review advanced options opens product settings", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "credentials required");
    await loginWithCredentials(page, email!, password!);
    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    test.skip(!(await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false)), "wizard not active");
    for (let i = 0; i < 7; i++) {
      await page.locator('input[type="radio"]').first().click();
      await page.getByRole("button", { name: "Next" }).click();
    }
    await page.getByRole("button", { name: /Continue to review/i }).click();
    await expect(page.getByTestId("calibration-review-root")).toBeVisible({ timeout: 120_000 });
    await page.getByRole("button", { name: /Review advanced options/i }).click();
    await page.waitForURL(/\/settings\/product/, { timeout: 60_000 });
  });

  test("Apply recommendation completes to dashboard", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "credentials required");
    await loginWithCredentials(page, email!, password!);
    await page.goto("/onboarding/calibration", { waitUntil: "domcontentloaded" });
    test.skip(!(await page.getByText(/Step 1 of 9/i).isVisible().catch(() => false)), "wizard not active");

    for (let i = 0; i < 7; i++) {
      await page.locator('input[type="radio"]').first().click();
      await page.getByRole("button", { name: "Next" }).click();
    }
    await page.getByRole("button", { name: /Continue to review/i }).click();
    await expect(page.getByTestId("calibration-review-root")).toBeVisible({ timeout: 120_000 });
    await page.getByRole("button", { name: /Apply recommendation/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  });
});
