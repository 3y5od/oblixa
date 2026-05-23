import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRateLimitKeyCardinality } from "./check-rate-limit-key-cardinality.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rate-limit-cardinality-"));
  try {
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const requiredFiles = {
  "src/lib/rate-limit.ts": [
    "export const RATE_LIMIT_KEY_MAX_LENGTH = 240;",
    "export function normalizeRateLimitKey(key) {",
    'createHash("sha256")',
    "const normalizedKey = normalizeRateLimitKey(key)",
    "upstash.limit(normalizedKey)",
    "return rateLimitTake(normalizedKey, config)",
  ].join("\n"),
  "src/lib/product-surface/api-workspace-guard.ts": "rateLimitCheck(`workspace-api:${input.orgId}:${input.apiPath}`\nRATE_LIMITS.workspaceApi\n",
  "src/app/api/external-actions/[token]/submit/route.ts": "rateLimitCheck(`external-submit:token-hash:${tokenKey}`\n",
  "src/app/api/external-actions/[token]/status/route.ts": "rateLimitCheck(`external-status:token-hash:${tokenKey}`\n",
  "src/app/api/external-actions/[token]/participant/workflow-step/route.ts": "rateLimitCheck(\n    `external-participant-workflow:token-hash:${tokenKey}`\n",
  "src/app/api/stripe/webhook/route.ts": "rateLimitCheck(`stripe-webhook:account:${event.account ?? \"platform\"}:${event.type}`\n",
  "src/lib/v6/cron-route-runner.ts": "rateLimitKey: options.rateLimitKey ?? `cron:v6:${options.route.split(\"/\").pop() ?? \"job\"}`\n",
  "src/app/api/cron/example/route.ts": "export const GET = withCronRoute({ route: \"/api/cron/example\", rateLimitKey: \"cron:example\" });\n",
};

test("analyzeRateLimitKeyCardinality accepts scoped route keys", () => {
  const report = withFixture(requiredFiles, analyzeRateLimitKeyCardinality);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeRateLimitKeyCardinality rejects missing token/provider/cron key scoping", () => {
  const report = withFixture(
    {
      ...requiredFiles,
      "src/app/api/external-actions/[token]/submit/route.ts": "rateLimitCheck(`external-submit:${ip}`\n",
      "src/app/api/stripe/webhook/route.ts": "rateLimitCheck(`stripe-webhook:${ip}`\n",
      "src/app/api/cron/example/route.ts": "export const GET = withCronRoute({ route: \"/api/cron/example\", rateLimitKey: \"example\" });\n",
    },
    analyzeRateLimitKeyCardinality
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_rate_limit_key_marker"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "cron_route_rate_limit_key_not_route_specific"), true);
});

test("analyzeRateLimitKeyCardinality rejects missing shared key normalization", () => {
  const report = withFixture(
    {
      ...requiredFiles,
      "src/lib/rate-limit.ts": "export function rateLimitCheck(key, config) { upstash.limit(key); return rateLimitTake(key, config); }\n",
    },
    analyzeRateLimitKeyCardinality
  );

  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some(
      (issue) => issue.issue === "missing_rate_limit_key_marker" && String(issue.marker).includes("normalizeRateLimitKey")
    ),
    true
  );
  assert.equal(
    report.issues.some(
      (issue) => issue.issue === "missing_rate_limit_key_marker" && String(issue.marker).includes("normalizedKey")
    ),
    true
  );
});
