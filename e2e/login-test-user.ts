import { test, type Page } from "@playwright/test";

export async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.locator("button[type='submit']").first().click();
  const reachedDashboard = await page
    .waitForURL(/\/dashboard/, {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    })
    .then(() => true)
    .catch(() => false);
  if (reachedDashboard) {
    return;
  }
  const rateLimited = await page
    .getByText(/too many sign-in attempts/i)
    .isVisible()
    .catch(() => false);
  if (rateLimited) {
    test.skip(true, "Auth provider rate-limited this test account.");
  }
  throw new Error("Login did not reach /dashboard and was not rate-limited.");
}
