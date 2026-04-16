import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";

test.describe("accessibility", () => {
  for (const route of GENERATED_PUBLIC_ROUTES.filter((entry) => entry.coverage.includes("a11y"))) {
    test(`${route.route} has no serious violations`, async ({ page }) => {
      await page.goto(route.visitPath);
      await expect(page.locator("h1")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? "")
      );
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});

