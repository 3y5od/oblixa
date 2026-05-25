import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeRuntimeHealthProbeContracts,
  buildRuntimeHealthProbeContracts,
  classifyProbeResult,
} from "./check-runtime-health-probe-contracts.mjs";

const routes = [
  {
    routeFile: "src/app/api/health/route.ts",
    pathTemplate: "/api/health",
    samplePath: "/api/health",
    methods: ["GET"],
    runnerHint: "public_or_token_surface",
    expectedOutcomes: ["200_ok"],
    smokeTier: "ci",
  },
  {
    routeFile: "src/app/api/accounts/route.ts",
    pathTemplate: "/api/accounts",
    samplePath: "/api/accounts",
    methods: ["GET"],
    runnerHint: "session_or_worker_unsigned_reject",
    expectedOutcomes: ["401_auth"],
    smokeTier: "nightly",
  },
];

test("buildRuntimeHealthProbeContracts creates local and linked read-only contracts", () => {
  const report = buildRuntimeHealthProbeContracts({ routes });
  assert.equal(report.localProbeCount, 2);
  assert.equal(report.optionalLinkedSupabaseProbes.every((probe) => probe.mutates === false), true);
  assert.ok(report.localProbes.every((probe) => probe.timeoutMs > 0));
});

test("analyzeRuntimeHealthProbeContracts requires critical local route categories", () => {
  const report = analyzeRuntimeHealthProbeContracts({ routes });
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);

  const missing = analyzeRuntimeHealthProbeContracts({ routes: [routes[0]] });
  assert.equal(missing.ok, false);
  assert.equal(missing.issues[0].issue, "missing_runtime_probe_category");
});

test("classifyProbeResult separates auth, schema, service, timeout, and success", () => {
  assert.equal(classifyProbeResult({ status: 200 }), "success");
  assert.equal(classifyProbeResult({ status: 401 }), "authentication_rejected");
  assert.equal(classifyProbeResult({ status: 404 }), "schema_missing");
  assert.equal(classifyProbeResult({ status: 503 }), "service_unavailable");
  assert.equal(classifyProbeResult({ timedOut: true }), "timeout");
  assert.equal(classifyProbeResult({ status: 418 }), "unexpected_status");
});
