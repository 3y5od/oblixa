/**
 * Tiers 8 + 21 — optional broader axe (WCAG2 A/AA tag scope) for marketing; PR keeps serious+critical in a11y.spec.ts.
 * Enable with: A11Y_NIGHTLY_MARKETING=1 npx playwright test e2e/a11y.nightly-optional-marketing-axe.spec.ts
 */
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=a11y_nightly_env_gate
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";

const marketingA11y = GENERATED_PUBLIC_ROUTES.filter(
  (e) => e.shellFamily === "marketing" && e.coverage.includes("a11y")
);

test.describe("a11y @a11y-nightly marketing (wcag2a+aa tag scope)", () => {
  test.skip(
    process.env.A11Y_NIGHTLY_MARKETING !== "1" && process.env.A11Y_NIGHTLY_MARKETING !== "true",
    "Set A11Y_NIGHTLY_MARKETING=1 to run WCAG2 A/AA–scoped axe on marketing (optional tier; may be noisier than PR bar)."
  );

  for (const route of marketingA11y) {
    test(`${route.route} @a11y-nightly`, async ({ page }) => {
      await page.goto(route.visitPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .options({
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa"],
          },
        })
        .analyze();
      const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});
