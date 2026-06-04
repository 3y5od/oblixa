import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_ROUTE_STATES } from "./generated/route-states";
import { resolveRouteStateVisitPath, routeStateNeedsAuth } from "./helpers/route-state-visit";
import { VISUAL_AUTH_ENABLED, VISUAL_ENABLED, snapshotName } from "./visual-helpers";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=visual_baselines_feature_flag_gated

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("visual route states", () => {
  test.skip(!VISUAL_ENABLED, "Set PLAYWRIGHT_VISUAL=1 to run screenshot baselines.");

  const publicRouteStates = VISUAL_AUTH_ENABLED
    ? []
    : GENERATED_ROUTE_STATES.filter((entry) => !routeStateNeedsAuth(entry.route));

  for (const state of publicRouteStates) {
    const slug = `${state.route}-${state.kind}-${state.sourcePath.replaceAll(/[^\w./-]+/g, "_")}`;
    test(`${state.route} ${state.kind} (${state.sourcePath})`, async ({ page }) => {
      await page.goto(resolveRouteStateVisitPath(state.route), { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      await expect(page).toHaveScreenshot(snapshotName("route-state", slug), {
        fullPage: false,
        maxDiffPixels: 500,
      });
    });
  }
});

test.describe("visual authenticated route states", () => {
  test.skip(
    !VISUAL_ENABLED || !VISUAL_AUTH_ENABLED || !E2E_EMAIL || !E2E_PASSWORD,
    "Set PLAYWRIGHT_VISUAL=1, PLAYWRIGHT_VISUAL_AUTH=1, E2E_TEST_EMAIL, and E2E_TEST_PASSWORD"
  );

  test.describe.configure({ timeout: 120_000 });

  for (const state of GENERATED_ROUTE_STATES.filter((entry) => routeStateNeedsAuth(entry.route))) {
    const slug = `${state.route}-${state.kind}-${state.sourcePath.replaceAll(/[^\w./-]+/g, "_")}`;
    test(`${state.route} ${state.kind} (${state.sourcePath})`, async ({ page, app }) => {
      await app.loginAsDefaultUser();
      await page.goto(resolveRouteStateVisitPath(state.route), { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      await expect(page).toHaveScreenshot(snapshotName("route-state", slug), {
        fullPage: false,
        maxDiffPixels: 500,
      });
    });
  }
});
