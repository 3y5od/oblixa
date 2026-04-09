import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function loginAsTestUser(page: Page) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(E2E_EMAIL!);
  await page.locator("input[type='password']").fill(E2E_PASSWORD!);
  await page.locator("button[type='submit']").first().click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("authenticated smoke", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );

  test("can log in and access dashboard/contracts/settings", async ({ page }) => {
    await loginAsTestUser(page);

    await page.goto("/contracts");
    await expect(page).toHaveURL(/\/contracts/);

    await page.goto("/settings/operations");
    await expect(page).toHaveURL(/\/settings\/operations/);
  });

  test("can access core V4 workspaces", async ({ page }) => {
    await loginAsTestUser(page);

    await page.goto("/contracts/programs");
    await expect(page).toHaveURL(/\/contracts\/programs/);

    await page.goto("/contracts/execution-graph");
    await expect(page).toHaveURL(/\/contracts\/execution-graph/);

    await page.goto("/contracts/exceptions");
    await expect(page).toHaveURL(/\/contracts\/exceptions/);

    await page.goto("/contracts/maintenance");
    await expect(page).toHaveURL(/\/contracts\/maintenance/);

    await page.goto("/contracts/reports");
    await expect(page).toHaveURL(/\/contracts\/reports/);

    await page.goto("/work");
    await expect(page).toHaveURL(/\/work/);

    await page.goto("/contracts/evidence-studio");
    await expect(page).toHaveURL(/\/contracts\/evidence-studio/);

    await page.goto("/settings/policy");
    await expect(page).toHaveURL(/\/settings\/policy/);

    await page.goto("/contracts/approvals/sla-simulator");
    await expect(page).toHaveURL(/\/contracts\/approvals\/sla-simulator/);

    await page.goto("/contracts/approvals/workload");
    await expect(page).toHaveURL(/\/contracts\/approvals\/workload/);
  });

  test("dashboard has no serious accessibility violations", async ({ page }) => {
    await loginAsTestUser(page);

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});

test.describe("V4 workspace mutations", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );

  test("evidence studio saves a template", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/evidence-studio");
    await expect(page.getByRole("heading", { name: /evidence studio/i })).toBeVisible();
    const name = `e2e-evidence-${Date.now()}`;
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole("button", { name: /save template/i }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("programs creates a draft program", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/programs");
    await expect(page.getByRole("heading", { name: /contract programs/i })).toBeVisible();
    const name = `e2e-program-${Date.now()}`;
    await page.getByPlaceholder("Customer MSA Program").fill(name);
    await page.getByRole("button", { name: /create program draft/i }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("maintenance creates a draft campaign", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/contracts/maintenance");
    await expect(page.getByRole("heading", { name: /maintenance workspace/i })).toBeVisible();
    const name = `e2e-campaign-${Date.now()}`;
    await page.getByPlaceholder("Q2 owner backfill").fill(name);
    await page.getByRole("button", { name: /create draft campaign/i }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});

