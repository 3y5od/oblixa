#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

const requiredEnvKeys = [
  "OPENAI_API_KEY",
  "EXTRACTION_WORKER_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
];

const issues = [];
for (const key of requiredEnvKeys) {
  if (!envExample.includes(key)) {
    issues.push({ issue: "missing_env_example_key", key });
  }
}

if (!pkg.scripts?.["check:env-example-parity"]) {
  issues.push({ issue: "missing_package_script", script: "check:env-example-parity" });
}

for (const cmd of [
  "npm run check:env-example-parity",
  "npm run check:config-drift",
  "npm run check:feature-flag-lifecycle",
]) {
  if (!ci.includes(cmd)) {
    issues.push({ issue: "missing_ci_reference", cmd });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
