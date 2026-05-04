import test from "node:test";
import assert from "node:assert/strict";
import { MAXIMAL_ASSURANCE_SCAFFOLDING_STEPS } from "./check-maximal-assurance-scaffolding.mjs";
import { ROUTE_FUNCTIONALITY_STEPS } from "./check-route-functionality.mjs";

test("route functionality bundle preserves route universe before red metrics", () => {
  assert.deepEqual(ROUTE_FUNCTIONALITY_STEPS, ["check:route-universe", "check:red-metrics-json"]);
});

test("maximal assurance scaffolding bundle keeps expected ordered checks", () => {
  assert.deepEqual(MAXIMAL_ASSURANCE_SCAFFOLDING_STEPS, [
    "check:maximal-assurance-plan-snapshot",
    "check:assurance-epics-registry",
    "check:assurance-program-semver",
    "check:assurance-waivers",
    "check:rls-sanity-tables",
    "check:catalog-script-index",
    "check:assurance-catalog-drift",
    "check:threat-row-coverage",
    "check:dashboard-start-transition-async",
    "verify:assurance-bundle-signature",
    "check:coverage-completeness",
    "check:assurance-epic-closure",
  ]);
});