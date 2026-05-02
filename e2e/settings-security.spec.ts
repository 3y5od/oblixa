import { test, expect } from "./fixtures/app-fixture";

test.describe("settings security surface", () => {
  test.describe.configure({ timeout: 120_000 });

  test("security page loads when authenticated", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await app.gotoAndWait("/settings/security");
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authenticator (TOTP)" })).toBeVisible();
  });
});
