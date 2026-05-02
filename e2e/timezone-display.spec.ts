// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=timezone_matrix_smoke
import { test, expect } from "@playwright/test";

test.describe("timezone display @nightly", () => {
  test("Intl formats a fixed instant in UTC without throwing", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const label = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(Date.UTC(2024, 5, 15, 12, 0, 0)))
    );
    expect(label).toMatch(/2024/);
  });

  test("optional multi-zone matrix when E2E_TIMEZONE_MATRIX=1", async ({ page }) => {
    test.skip(!process.env.E2E_TIMEZONE_MATRIX, "Set E2E_TIMEZONE_MATRIX=1 for America/New_York vs Asia/Tokyo.");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const ny = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric" }).format(
        new Date(Date.UTC(2024, 5, 15, 12, 0, 0))
      )
    );
    const tk = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric" }).format(
        new Date(Date.UTC(2024, 5, 15, 12, 0, 0))
      )
    );
    expect(ny).toBeTruthy();
    expect(tk).toBeTruthy();
    expect(ny).not.toEqual(tk);
  });
});
