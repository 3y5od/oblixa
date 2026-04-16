import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";

test.describe("a11y landmarks", () => {
  for (const route of GENERATED_PUBLIC_ROUTES.filter((entry) => entry.coverage.includes("a11y"))) {
    test(`${route.route} exposes a main landmark`, async ({ page }) => {
      await page.goto(route.visitPath, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("main")).toBeVisible();
    });
  }
});

