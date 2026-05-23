#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_TEST_MARKERS = {
  "src/app/api/export/calendar/feed/[token]/route.test.ts": [
    "returns 404 when token is not found",
    "returns 404 when feed is expired or revoked",
  ],
  "src/app/api/external-actions/[token]/status/route.test.ts": [
    "returns 404 when external action token is not found",
    "returns 410 when external action token is revoked",
    "returns externalAction payload shape without exposing internal workflow payloads",
  ],
  "src/app/api/external-actions/[token]/submit/route.test.ts": [
    "returns 410 when external action link is expired",
    "returns 410 when external action link is revoked",
    "returns duplicate response when idempotency blocks submit replay",
    "returns 403 when requires_reauth and submit ticket missing",
  ],
  "src/app/api/external-actions/[token]/participant/workflow-step/route.test.ts": [
    "returns 404 when participant workflow token is not found",
    "returns 410 when participant workflow token is revoked",
    "returns 410 when participant workflow token is expired",
    "blocks duplicate replay of participant workflow-step with x-idempotency-key",
  ],
  "src/app/api/external-actions/[token]/workflow-step/route.test.ts": [
    "rejects revoked public-token links before appending workflow steps",
    "blocks duplicate replay of internal workflow-step with x-idempotency-key",
  ],
  "src/app/api/reports/track/open/[token]/route.test.ts": [
    "returns tracking pixel even for short token",
    "returns a pixel without writing when tracking token is not found",
    "returns a pixel without writing when tracking token is revoked",
  ],
  "src/app/api/reports/track/click/[token]/route.test.ts": [
    "redirects to dashboard fallback for invalid target",
    "redirects without writing when click tracking token is not found",
    "redirects without writing when click tracking token is revoked",
    "redacts target query strings and fragments before storing click targets",
  ],
  "src/app/api/external-actions/create-link/route.test.ts": [
    "returns 400 for invalid actionType",
    "returns 400 when workflowDeadlineIso is after link expiry",
    "allows passcode-protected sensitive links without forcing reauth",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzePublicTokenNegativeTests(root = ROOT) {
  const issues = [];
  const pkg = JSON.parse(read(root, "package.json"));
  if (!pkg.scripts?.["check:public-token-negative-tests"]) {
    issues.push({ issue: "missing_package_script", script: "check:public-token-negative-tests" });
  }
  const ci = read(root, ".github/workflows/ci.yml");
  if (!ci.includes("npm run check:public-token-negative-tests")) {
    issues.push({ issue: "missing_ci_reference", cmd: "npm run check:public-token-negative-tests" });
  }
  const pipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  if (!pipeline.includes('"check:public-token-negative-tests"')) {
    issues.push({ issue: "missing_security_pipeline_step", step: "check:public-token-negative-tests" });
  }
  for (const [rel, markers] of Object.entries(REQUIRED_TEST_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_token_route_test", rel });
      continue;
    }
    const source = read(root, rel);
    for (const marker of markers) {
      if (!source.includes(marker)) issues.push({ issue: "missing_negative_test_marker", rel, marker });
    }
  }

  return {
    checkId: "public-token-negative-tests",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePublicTokenNegativeTests();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
