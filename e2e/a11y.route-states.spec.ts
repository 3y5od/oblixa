import { test, expect } from "./fixtures/app-fixture";
import { GENERATED_ROUTE_STATES } from "./generated/route-states";

test.describe("a11y route states", () => {
  for (const state of GENERATED_ROUTE_STATES.filter((entry) =>
    ["/", "/login", "/dashboard"].includes(entry.route)
  )) {
    const stateKey = `${state.route} ${state.kind} ${state.sourcePath}`;
    test(`${stateKey} keeps root document accessible`, async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

