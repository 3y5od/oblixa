import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzePublicTokenNegativeTests } from "./check-public-token-negative-tests.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

const requiredTests = {
  "src/app/api/export/calendar/feed/[token]/route.test.ts": "returns 404 when token is not found\nreturns 404 when feed is expired or revoked\n",
  "src/app/api/external-actions/[token]/status/route.test.ts": "returns 404 when external action token is not found\nreturns 410 when external action token is revoked\nreturns externalAction payload shape without exposing internal workflow payloads\n",
  "src/app/api/external-actions/[token]/submit/route.test.ts": "returns 410 when external action link is expired\nreturns 410 when external action link is revoked\nreturns duplicate response when idempotency blocks submit replay\nreturns 403 when requires_reauth and submit ticket missing\n",
  "src/app/api/external-actions/[token]/participant/workflow-step/route.test.ts": "returns 404 when participant workflow token is not found\nreturns 410 when participant workflow token is revoked\nreturns 410 when participant workflow token is expired\nblocks duplicate replay of participant workflow-step with x-idempotency-key\n",
  "src/app/api/external-actions/[token]/workflow-step/route.test.ts": "rejects revoked public-token links before appending workflow steps\nblocks duplicate replay of internal workflow-step with x-idempotency-key\n",
  "src/app/api/reports/track/open/[token]/route.test.ts": "returns tracking pixel even for short token\nreturns a pixel without writing when tracking token is not found\nreturns a pixel without writing when tracking token is revoked\n",
  "src/app/api/reports/track/click/[token]/route.test.ts": "redirects to dashboard fallback for invalid target\nredirects without writing when click tracking token is not found\nredirects without writing when click tracking token is revoked\nredacts target query strings and fragments before storing click targets\n",
  "src/app/api/external-actions/create-link/route.test.ts": "returns 400 for invalid actionType\nreturns 400 when workflowDeadlineIso is after link expiry\nallows passcode-protected sensitive links without forcing reauth\n",
};

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-public-token-negative-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:public-token-negative-tests": "node scripts/check-public-token-negative-tests.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:public-token-negative-tests\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:public-token-negative-tests"\n');
  for (const [rel, content] of Object.entries(requiredTests)) write(root, rel, content);
  return root;
}

test("public token negative coverage check accepts complete route tests", () => {
  const root = fixtureRoot();
  assert.equal(analyzePublicTokenNegativeTests(root).ok, true);
});

test("public token negative coverage check rejects missing revoked coverage", () => {
  const root = fixtureRoot();
  write(root, "src/app/api/external-actions/[token]/submit/route.test.ts", "returns 410 when external action link is expired\n");
  const report = analyzePublicTokenNegativeTests(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_negative_test_marker"));
});
