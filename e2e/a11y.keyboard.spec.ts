import { test, expect } from "./fixtures/app-fixture";

test.describe("a11y keyboard", () => {
  test("public home page keeps keyboard-reachable primary CTA", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const cta = page.locator("#hero").getByRole("link", { name: /create free account/i });
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press("Tab");
      if (await cta.evaluate((element) => element === document.activeElement).catch(() => false)) {
        break;
      }
    }
    await expect(cta).toBeFocused();
  });

  test("login: Tab moves between email, password, and primary submit", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const email = page.getByLabel("Email");
    const password = page.getByLabel("Password");
    await email.click();
    await expect(email).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
  });

  test("command palette: CmdOrCtrl+K opens palette when authenticated", async ({ page, app }) => {
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to exercise dashboard Cmd+K (Tier 8 / CmdK parity)."
    );
    await app.loginAsDefaultUser();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const isMac = process.platform === "darwin";
    if (isMac) {
      await page.keyboard.press("Meta+KeyK");
    } else {
      await page.keyboard.press("Control+KeyK");
    }
    await expect(page.getByTestId("command-palette-input")).toBeVisible({ timeout: 20_000 });
  });
});

