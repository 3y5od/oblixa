import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(E2E_EMAIL!);
  await page.locator("input[type='password']").fill(E2E_PASSWORD!);
  await page.locator("button[type='submit']").first().click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("v3 workflow smoke", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run V3 smoke.");

  test("can open workflow hubs", async ({ page }) => {
    await signIn(page);
    await page.goto("/contracts/tasks");
    await expect(page).toHaveURL(/\/contracts\/tasks/);
    await page.goto("/contracts/obligations");
    await expect(page).toHaveURL(/\/contracts\/obligations/);
    await page.goto("/contracts/approvals");
    await expect(page).toHaveURL(/\/contracts\/approvals/);
    await page.goto("/contracts/renewals");
    await expect(page).toHaveURL(/\/contracts\/renewals/);
  });

  test("can open reporting and persona surfaces", async ({ page }) => {
    await signIn(page);
    await page.goto("/contracts/analytics");
    await expect(page).toHaveURL(/\/contracts\/analytics/);
    await page.goto("/contracts/reports");
    await expect(page).toHaveURL(/\/contracts\/reports/);
    await page.goto("/contracts/data-quality");
    await expect(page).toHaveURL(/\/contracts\/data-quality/);
    await page.goto("/dashboard/persona");
    await expect(page).toHaveURL(/\/dashboard\/persona/);
  });

  test("can access intake and discover operations tools from more", async ({ page }) => {
    await signIn(page);
    await page.goto("/contracts/intake");
    await expect(page).toHaveURL(/\/contracts\/intake/);

    await page.goto("/more?section=operations");
    await expect(page).toHaveURL(/\/more\?section=operations/);
    const operationsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Operations workflows" }),
    });
    await expect(operationsSection.getByRole("link", { name: "Renewals" })).toBeVisible();
    await expect(operationsSection.getByRole("link", { name: "Intake" })).toBeVisible();
    await expect(operationsSection.getByRole("link", { name: "Approvals" })).toBeVisible();
  });
});
