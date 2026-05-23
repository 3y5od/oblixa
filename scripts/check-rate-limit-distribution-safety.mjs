#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function analyzeRateLimitDistributionSafety(root = process.cwd()) {
  const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const rateLimitSource = fs.readFileSync(path.join(root, "src/lib/rate-limit.ts"), "utf8");

  const issues = [];
  if (!envExample.includes("UPSTASH_REDIS_REST_URL") || !envExample.includes("UPSTASH_REDIS_REST_TOKEN")) {
    issues.push({ issue: "missing_upstash_env_docs" });
  }
  if (
    !/getUpstashLimiter/.test(rateLimitSource) ||
    !/upstash\.limit\(normalizedKey\)/.test(rateLimitSource) ||
    !/return rateLimitTake\(normalizedKey, config\)/.test(rateLimitSource) ||
    !/Distributed limiter is required in production; failing closed/.test(rateLimitSource) ||
    !/Upstash limit\(\) failed in production; failing closed/.test(rateLimitSource)
  ) {
    issues.push({ issue: "missing_explicit_distributed_fallback_logic" });
  }
  if (
    !/RATE_LIMIT_KEY_MAX_LENGTH/.test(rateLimitSource) ||
    !/normalizeRateLimitKey/.test(rateLimitSource) ||
    !/createHash\("sha256"\)/.test(rateLimitSource)
  ) {
    issues.push({ issue: "missing_rate_limit_key_normalization" });
  }
  if (!/per instance|not global/i.test(rateLimitSource)) {
    issues.push({ issue: "missing_fallback_risk_annotation" });
  }

  return {
    checkId: "rate-limit-distribution-safety",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRateLimitDistributionSafety();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
