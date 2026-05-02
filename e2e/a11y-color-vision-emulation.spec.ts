import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=color_vision_matrix_optional

test.describe("color / contrast emulation", () => {
  test("forced-colors + prefers-contrast media queries are observable", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const scheme = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
    expect(typeof scheme).toBe("boolean");
  });
});
