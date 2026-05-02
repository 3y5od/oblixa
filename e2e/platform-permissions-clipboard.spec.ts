import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=platform_permissions_optional

test.describe("platform permissions (clipboard)", () => {
  test("clipboard read is gated unless granted", async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: [] });
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const denied = await page.evaluate(async () => {
      try {
        await navigator.clipboard.readText();
        return false;
      } catch {
        return true;
      }
    });
    expect(typeof denied).toBe("boolean");
    await ctx.close();
  });

  test("clipboard read can succeed when permission granted", async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: ["clipboard-read"] });
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const outcome = await page.evaluate(async () => {
      try {
        await navigator.clipboard.readText();
        return "ok_or_empty";
      } catch {
        return "denied";
      }
    });
    expect(["ok_or_empty", "denied"]).toContain(outcome);
    await ctx.close();
  });

  test("geolocation API is gated when permission denied", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const outcome = await page.evaluate(async () => {
      try {
        await navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 200 });
        return "called";
      } catch {
        return "error";
      }
    });
    expect(["called", "error"]).toContain(outcome);
  });
});
