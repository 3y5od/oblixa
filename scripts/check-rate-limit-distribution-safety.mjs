#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const rateLimitSource = fs.readFileSync(path.join(root, "src/lib/rate-limit.ts"), "utf8");

const issues = [];
if (!envExample.includes("UPSTASH_REDIS_REST_URL") || !envExample.includes("UPSTASH_REDIS_REST_TOKEN")) {
  issues.push({ issue: "missing_upstash_env_docs" });
}
if (!/getUpstashLimiter/.test(rateLimitSource) || !/return rateLimitTake\(key, config\)/.test(rateLimitSource)) {
  issues.push({ issue: "missing_explicit_distributed_fallback_logic" });
}
if (!/per instance|not global/i.test(rateLimitSource)) {
  issues.push({ issue: "missing_fallback_risk_annotation" });
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
