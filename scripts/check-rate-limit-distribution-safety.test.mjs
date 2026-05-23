import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRateLimitDistributionSafety } from "./check-rate-limit-distribution-safety.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rate-limit-distribution-"));
  try {
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const validFiles = {
  ".env.example": "UPSTASH_REDIS_REST_URL=\nUPSTASH_REDIS_REST_TOKEN=\n",
  "src/lib/rate-limit.ts": [
    'import { createHash } from "node:crypto";',
    "export const RATE_LIMIT_KEY_MAX_LENGTH = 240;",
    'export function normalizeRateLimitKey(key) { return createHash("sha256").update(key).digest("hex"); }',
    "function getUpstashLimiter() {}",
    "async function rateLimitCheck(key, config) {",
    "  const normalizedKey = normalizeRateLimitKey(key);",
    "  await upstash.limit(normalizedKey);",
    '  console.error("[rate-limit] Distributed limiter is required in production; failing closed");',
    '  console.error("[rate-limit] Upstash limit() failed in production; failing closed");',
    "  return rateLimitTake(normalizedKey, config);",
    "}",
    "// fallback is per instance, not global",
  ].join("\n"),
};

test("analyzeRateLimitDistributionSafety accepts normalized distributed and fallback paths", () => {
  const report = withFixture(validFiles, analyzeRateLimitDistributionSafety);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeRateLimitDistributionSafety rejects raw distributed and fallback keys", () => {
  const report = withFixture(
    {
      ...validFiles,
      "src/lib/rate-limit.ts": [
        "function getUpstashLimiter() {}",
        "async function rateLimitCheck(key, config) {",
        "  await upstash.limit(key);",
        "  return rateLimitTake(key, config);",
        "}",
        "// fallback is per instance, not global",
      ].join("\n"),
    },
    analyzeRateLimitDistributionSafety
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_explicit_distributed_fallback_logic"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_rate_limit_key_normalization"), true);
});
