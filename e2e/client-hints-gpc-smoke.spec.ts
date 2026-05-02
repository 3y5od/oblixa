import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=client_hints_matrix_optional

test.describe("client hints + Save-Data + GPC", () => {
  test("home responds when hints are set", async ({ browser }) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: {
        "Sec-CH-UA": '"Not.A/Brand";v="8", "Chromium";v="120"',
        "Save-Data": "on",
        "Sec-GPC": "1",
      },
    });
    const page = await ctx.newPage();
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    await ctx.close();
  });
});
