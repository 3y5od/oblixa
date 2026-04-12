import { test, expect } from "@playwright/test";

test.describe("external token surface", () => {
  test("invalid token path returns a non-5xx response", async ({ page }) => {
    const res = await page.goto("/external/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status() ?? 0).toBeGreaterThanOrEqual(200);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });
});
