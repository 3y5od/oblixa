import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("authenticated smoke", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke."
  );

  test("can log in and access dashboard/contracts/settings", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email']").fill(E2E_EMAIL!);
    await page.locator("input[type='password']").fill(E2E_PASSWORD!);
    await page.locator("button[type='submit']").first().click();
    await page.waitForURL(/\/dashboard/);

    await page.goto("/contracts");
    await expect(page).toHaveURL(/\/contracts/);

    await page.goto("/settings/operations");
    await expect(page).toHaveURL(/\/settings\/operations/);
  });

  test("dashboard has no serious accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email']").fill(E2E_EMAIL!);
    await page.locator("input[type='password']").fill(E2E_PASSWORD!);
    await page.locator("button[type='submit']").first().click();
    await page.waitForURL(/\/dashboard/);

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});

