import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { GENERATED_ROUTE_STATES } from "./generated/route-states";
import { annotateRouteState } from "./fixtures/route-state-fixture";
import { annotateWorkspaceMode } from "./fixtures/workspace-mode-fixture";
import { resolveRouteStateVisitPath, routeStateNeedsAuth } from "./helpers/route-state-visit";
import { ensureAuthenticatedSession } from "./login-test-user";

// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=a11y_route_states_e2e_credentials_gate

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("a11y route states", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await annotateWorkspaceMode(page, "default");
    await annotateRouteState(page, "default");
  });

  for (const state of GENERATED_ROUTE_STATES) {
    const stateKey = `${state.route} ${state.kind} ${state.sourcePath}`;
    test(`${stateKey} has no serious or critical axe violations`, async ({ page }) => {
      test.setTimeout(60_000);
      if (routeStateNeedsAuth(state.route)) {
        test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
        await ensureAuthenticatedSession(page, E2E_EMAIL!, E2E_PASSWORD!);
      }

      await page.goto(resolveRouteStateVisitPath(state.route), { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(100);
      await expect(page.locator("body")).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});
