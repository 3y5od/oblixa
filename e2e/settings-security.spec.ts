import { test, expect } from "./fixtures/app-fixture";
import { settleWebKitWorker } from "./fixtures/webkit-worker-teardown";

test.describe("settings security surface", () => {
  test.describe.configure({ timeout: 120_000 });

  test.afterAll(async ({}, testInfo) => {
    await settleWebKitWorker(testInfo);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "wait" });
    if (!page.isClosed()) {
      await page.close({ runBeforeUnload: false });
    }
  });

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
      page.getByText("Manage workspace, team, billing, notifications, security, and data export.")
    ).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Product experience" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);

    // Profile/Workspace/Team are inline editor cards now, not directory rows —
    // the former directory anchor links (Rename / Invite member / Edit profile)
    // no longer exist. The inline cards still carry their #ids for deep links.
    await expect(page.locator("#workspace-identity")).toBeVisible();
    await expect(page.locator("#team-access")).toBeVisible();
    await expect(page.locator("#profile")).toBeVisible();

    await expect(page.getByRole("listitem").filter({ hasText: "Legal calendar" })).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: "Finance calendar" })).toHaveCount(0);
  });
});
