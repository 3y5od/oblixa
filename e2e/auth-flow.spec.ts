import { shellTestIds } from "@/lib/qa/test-ids";
import { test, expect } from "./fixtures/app-fixture";
import { AuthPO } from "./page-objects/AuthPO";

test.describe("auth flow smoke", () => {
  test("dashboard unauthenticated access redirects to login", async ({ page }) => {
    const auth = new AuthPO(page);
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    await auth.expectLoginLoaded();
  });

  test("contracts unauthenticated access redirects to login", async ({ page }) => {
    const auth = new AuthPO(page);
    await page.goto("/contracts");
    await page.waitForURL(/\/login/);
    await auth.expectLoginLoaded();
  });

  test("post sign-out endpoint redirects to login and clears browser session state", async ({ request }) => {
    const res = await request.get("/api/auth/post-sign-out", { maxRedirects: 0 });

    expect([302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
    expect(res.headers()["clear-site-data"]).toContain('"cookies"');
    expect(res.headers()["clear-site-data"]).toContain('"cache"');
  });

  test("authenticated sign out returns to login", async ({ page, app }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const auth = new AuthPO(page);

    await app.loginAsDefaultUser();
    await app.gotoAndWait("/dashboard");

    const signOut = page
      .getByTestId(shellTestIds.sidebarSignOut)
      .filter({ hasText: /^Sign out$/i })
      .first();
    await expect(signOut).toBeVisible({ timeout: 30_000 });
    await signOut.click();

    await auth.expectLoginLoaded();
    await expect(page.getByTestId(shellTestIds.sidebarSignOut)).toHaveCount(0);
  });
});
