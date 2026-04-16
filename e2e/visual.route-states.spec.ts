import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_ROUTE_STATES } from "./generated/route-states";
import { VISUAL_ENABLED, snapshotName } from "./visual-helpers";
// skip-meta-default: owner=@test-governance expiry=2026-12-31 reason=visual_baselines_feature_flag_gated

test.describe("visual route states", () => {
  test.skip(!VISUAL_ENABLED, "Set PLAYWRIGHT_VISUAL=1 to run screenshot baselines.");

  for (const state of GENERATED_ROUTE_STATES.filter((entry) =>
    ["/", "/login", "/dashboard", "/contracts/[id]"].includes(entry.route)
  )) {
    test(`${state.route} ${state.kind} state placeholder`, async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveScreenshot(snapshotName("route-state", `${state.route}-${state.kind}`), {
        fullPage: false,
      });
    });
  }
});

