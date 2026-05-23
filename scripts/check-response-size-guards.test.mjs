import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeResponseSizeGuards } from "./check-response-size-guards.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test("response-size guard check requires helper, tests, CI, and pipeline wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-response-size-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:response-size-guards": "node scripts/check-response-size-guards.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:response-size-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:response-size-guards"\n');
  write(root, "src/lib/security/response-size.ts", "API_RESPONSE_LIMIT_SMALL_JSON\njsonResponseWithSizeLimit\nencodedJsonSizeBytes\nresponse_too_large\napi_response_size_limit_exceeded\n");
  write(root, "src/lib/security/response-size.test.ts", "returns a safe problem response when the payload exceeds the limit\nresponse_too_large\n");
  write(root, "src/app/api/capacity/forecast/route.ts", "jsonResponseWithSizeLimit\nAPI_RESPONSE_LIMIT_SMALL_JSON\nCache-Control\n");
  write(root, "src/app/api/capacity/forecast/route.test.ts", "rejects oversized forecast responses with a safe problem response\nresponse_too_large\n");

  assert.equal(analyzeResponseSizeGuards(root).ok, true);
});

test("response-size guard check fails on missing route over-limit coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-response-size-missing-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:response-size-guards": "node scripts/check-response-size-guards.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:response-size-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:response-size-guards"\n');
  write(root, "src/lib/security/response-size.ts", "API_RESPONSE_LIMIT_SMALL_JSON\njsonResponseWithSizeLimit\nencodedJsonSizeBytes\nresponse_too_large\napi_response_size_limit_exceeded\n");
  write(root, "src/lib/security/response-size.test.ts", "returns a safe problem response when the payload exceeds the limit\nresponse_too_large\n");
  write(root, "src/app/api/capacity/forecast/route.ts", "jsonResponseWithSizeLimit\nAPI_RESPONSE_LIMIT_SMALL_JSON\nCache-Control\n");
  write(root, "src/app/api/capacity/forecast/route.test.ts", "happy path only\n");

  const report = analyzeResponseSizeGuards(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_marker" && issue.rel === "src/app/api/capacity/forecast/route.test.ts"));
});
