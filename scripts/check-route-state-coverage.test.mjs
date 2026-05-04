import test from "node:test";
import assert from "node:assert/strict";
import { collectEffectiveRouteStateKinds } from "./check-route-state-coverage.mjs";

test("collectEffectiveRouteStateKinds applies shared auth-shell states to sibling auth routes", () => {
  const manifest = [
    { route: "/login", kind: "loading", sourcePath: "src/app/(auth)/loading.tsx", shellFamily: "auth" },
    { route: "/login", kind: "error", sourcePath: "src/app/(auth)/error.tsx", shellFamily: "auth" },
  ];
  const kinds = [...collectEffectiveRouteStateKinds("/signup", "auth", manifest, false)].sort();
  assert.deepEqual(kinds, ["error", "loading"]);
});

test("collectEffectiveRouteStateKinds applies prefix states to nested dashboard routes", () => {
  const manifest = [{ route: "/settings", kind: "loading", sourcePath: "src/app/(dashboard)/settings/loading.tsx", shellFamily: "dashboard" }];
  const kinds = [...collectEffectiveRouteStateKinds("/settings/billing", "dashboard", manifest, false)];
  assert.deepEqual(kinds, ["loading"]);
});