import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_ROUTE_STATES } from "./generated/route-states";
import { resolveRouteStateVisitPath, routeStateNeedsAuth } from "./helpers/route-state-visit";

// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=a11y_route_states_e2e_credentials_gate

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("a11y route states", () => {
  for (const state of GENERATED_ROUTE_STATES) {
    const stateKey = `${state.route} ${state.kind} ${state.sourcePath}`;
    test(`${stateKey} has no serious or critical axe violations`, async ({ page, app }) => {
      if (routeStateNeedsAuth(state.route)) {
        test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
        await app.loginAsDefaultUser();
      }

      await page.goto(resolveRouteStateVisitPath(state.route), { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});
