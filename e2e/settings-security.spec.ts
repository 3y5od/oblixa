import { test, expect } from "./fixtures/app-fixture";

test.describe("settings security surface", () => {
  test.describe.configure({ timeout: 120_000 });

  test("security page loads when authenticated", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await app.gotoAndWait("/settings/security");
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authenticators" })).toBeVisible();
  });

  test("settings refinement runtime checks pass for Core admin and mobile anchors", async ({ page, app }) => {
    await app.loginAsDefaultUser();
    await page.setViewportSize({ width: 390, height: 900 });
    await app.gotoAndWait("/settings");

    await expect(page.getByRole("heading", { name: /^Settings$/ })).toBeVisible();
    await expect(
      page.getByText("Manage workspace, team, billing, notifications, security, and export settings.")
    ).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Product experience" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Settings directory" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);

    for (const { name, hash, target } of [
      { name: "Rename", hash: "#workspace-identity", target: "#workspace-identity" },
      { name: "Invite member", hash: "#team-access", target: "#team-access" },
      { name: "Edit profile", hash: "#profile", target: "#profile" },
    ] as const) {
      await page.getByRole("link", { name }).click();
      await expect(page.locator(target)).toBeFocused();
      expect(new URL(page.url()).hash).toBe(hash);
    }

    await expect(page.getByRole("listitem").filter({ hasText: "Legal calendar" })).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: "Finance calendar" })).toHaveCount(0);
  });
});
