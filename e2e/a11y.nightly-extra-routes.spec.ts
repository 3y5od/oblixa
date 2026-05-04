/**
 * Epic 10 — Extra axe routes from artifacts/assurance/a11y-nightly-extra-routes.json (opt-in nightly).
 * Enable with: A11Y_NIGHTLY_EXTRA_ROUTES=1 npx playwright test e2e/a11y.nightly-extra-routes.spec.ts
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const enabled = process.env.A11Y_NIGHTLY_EXTRA_ROUTES === "1" || process.env.A11Y_NIGHTLY_EXTRA_ROUTES === "true";

if (enabled) {
  test.describe("a11y nightly extra routes @epic10", () => {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "artifacts", "assurance", "a11y-nightly-extra-routes.json"),
      "utf8"
    );
    const doc = JSON.parse(raw) as { routes: string[] };

    for (const route of doc.routes) {
      test(`${route} @a11y-nightly-extra`, async ({ page }) => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1")).toBeVisible();
        const results = await new AxeBuilder({ page })
          .options({
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
          })
          .analyze();
        const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
        expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      });
    }
  });
}
