import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("accessibility", () => {
  test("home page has no serious violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test("login page has no serious violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test("signup page has no serious violations", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test("forgot-password page has no serious violations", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test("reset-password page has no serious violations", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});

