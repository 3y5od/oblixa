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
});

