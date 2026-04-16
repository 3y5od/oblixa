import { test, expect, type Page } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=v3_legacy_workflow_smokes_are_fixture_gated

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function signIn(page: Page) {
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

test.describe("v3 workflow smoke", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run V3 smoke.");

  test("can open workflow hubs", async ({ page }) => {
    await signIn(page);
    await page.goto("/contracts/tasks", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/tasks/);
    await page.goto("/contracts/obligations", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/obligations/);
    await page.goto("/contracts/approvals", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/approvals/);
    await page.goto("/contracts/renewals", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/renewals/);
  });

  test("can open reporting and persona surfaces", async ({ page }) => {
    await signIn(page);
    await page.goto("/contracts/analytics", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/analytics/);
    await page.goto("/contracts/reports", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/reports/);
    await page.goto("/contracts/data-quality", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/data-quality/);
    await page.goto("/dashboard/persona", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/persona/);
  });

  test("can access intake and discover operations tools from more", async ({ page }) => {
    await signIn(page);
    await page.goto("/contracts/intake", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contracts\/intake/);

    await page.goto("/more?section=operations", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/more\?section=operations/);
    const operationsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Operations workflows" }),
    });
    await expect(operationsSection.getByRole("link", { name: "Renewals" })).toBeVisible();
    await expect(operationsSection.getByRole("link", { name: "Intake" })).toBeVisible();
    await expect(operationsSection.getByRole("link", { name: "Approvals" })).toBeVisible();
  });
});
