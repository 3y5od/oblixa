import test from "node:test";
import assert from "node:assert/strict";
import { findMissingRequiredAppRouterStateFailures } from "./check-route-universe.mjs";

test("findMissingRequiredAppRouterStateFailures flags missing loading/error/not_found states", () => {
  const failures = findMissingRequiredAppRouterStateFailures([
    {
      kind: "page",
      sourcePath: "src/app/foo/page.tsx",
      routeStates: {
        required: ["loading", "error", "not_found", "mobile"],
        present: ["loading", "error"],
      },
    },
  ]);

  assert.deepEqual(failures, ["src/app/foo/page.tsx:missing_required_app_router_state:not_found"]);
});

test("findMissingRequiredAppRouterStateFailures ignores non-page rows and non-app-router states", () => {
  const failures = findMissingRequiredAppRouterStateFailures([
    {
      kind: "api_route",
      sourcePath: "src/app/api/foo/route.ts",
      routeStates: { required: [], present: [] },
    },
    {
      kind: "page",
      sourcePath: "src/app/bar/page.tsx",
      routeStates: { required: ["loading", "mobile"], present: ["loading"] },
    },
  ]);

  assert.deepEqual(failures, []);
});