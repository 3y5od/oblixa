import test from "node:test";
import assert from "node:assert/strict";
import { buildApiRuntimeSmokeRegistryPayload } from "./lib/build-api-runtime-smoke-registry.mjs";
import {
  assertCronSemanticContract,
  classifyRuntimeSmokeResponse,
  defaultExpectedOutcomesForRunnerHint,
} from "./lib/route-runtime-semantics.mjs";

test("runtime smoke registry classifies tracking routes as public/token semantic surfaces", () => {
  const payload = buildApiRuntimeSmokeRegistryPayload(process.cwd());
  const row = payload.routes.find((entry) => entry.pathTemplate === "/api/reports/track/open/[token]");

  assert.ok(row);
  assert.equal(row.runnerHint, "public_or_token_surface");
  assert.ok(row.expectedOutcomes.includes("302_redirect"));
  assert.equal(row.verificationHint, "public_or_token_semantic");
});

test("defaultExpectedOutcomesForRunnerHint adds validation outcomes for non-GET public/token routes", () => {
  assert.deepEqual(defaultExpectedOutcomesForRunnerHint("public_or_token_surface", ["POST"]), [
    "200_success",
    "400_validation",
    "404_not_found",
    "429_rate_limited",
    "503_dependency_blocked",
  ]);
});

test("classifyRuntimeSmokeResponse accepts dependency-blocked public outcomes", () => {
  const result = classifyRuntimeSmokeResponse(
    {
      runnerHint: "public_or_token_surface",
      methods: ["GET"],
      expectedOutcomes: ["503_dependency_blocked"],
    },
    {
      status: 503,
      headers: new Headers({ "content-type": "application/json" }),
    },
    JSON.stringify({ code: "dependency_blocked", error: "dependency_blocked" })
  );

  assert.equal(result.passed, true);
  assert.equal(result.outcomeClass, "dependency_blocked");
});

test("assertCronSemanticContract detects inconsistent notification retry totals", () => {
  assert.deepEqual(
    assertCronSemanticContract("/api/notifications/retry-deliveries", {
      scanned: 5,
      delivered: 1,
      failed: 1,
      retried: 1,
      skipped: 1,
    }),
    ["scanned:bucket_total_mismatch"]
  );
});

test("assertCronSemanticContract accepts review-board packet summary counts", () => {
  assert.deepEqual(
    assertCronSemanticContract("/api/cron/v6/review-board-packet-generation", {
      generated: 2,
      duplicateRunsSkipped: 1,
      boardsScanned: 3,
      notificationsAttempted: 4,
      notificationsDelivered: 3,
    }),
    []
  );
});