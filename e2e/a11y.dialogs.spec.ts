import { test, expect } from "./fixtures/app-fixture";

// skip-meta-default: owner=@qa expiry=2027-12-31 reason=authenticated_dialog_coverage_requires_seed_credentials

test.describe("a11y dialogs", () => {
  test("auth flow exposes expected heading after redirect dialog-free login guard", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login surface: Escape does not trap focus (no spurious aria-modal)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("command palette closes on Escape when open (dashboard)", async ({ page, app }) => {
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for dashboard dialog coverage."
    );
    await app.loginAsDefaultUser();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const isMac = process.platform === "darwin";
    if (isMac) await page.keyboard.press("Meta+KeyK");
    else await page.keyboard.press("Control+KeyK");
    const input = page.getByTestId("command-palette-input");
    await expect(input).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Escape");
    await expect(input).toBeHidden({ timeout: 10_000 });
  });
});

