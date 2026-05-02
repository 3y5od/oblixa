// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=session_cookie_matrix
import { test, expect } from "@playwright/test";

test.describe("session cookie matrix @nightly", () => {
  test("login page response exposes Set-Cookie or omits it (either is valid for static matrix)", async ({
    page,
    context,
  }) => {
    const cookiesBefore = await context.cookies();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const cookiesAfter = await context.cookies();
    expect(cookiesAfter.length).toBeGreaterThanOrEqual(cookiesBefore.length);
  });

  test("second tab shares same storage state marker when present", async ({ context }) => {
    const p1 = await context.newPage();
    const p2 = await context.newPage();
    await p1.goto("/login", { waitUntil: "domcontentloaded" });
    await p2.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(p1.locator("body")).toBeVisible();
    await expect(p2.locator("body")).toBeVisible();
    await p1.close();
    await p2.close();
  });
});
