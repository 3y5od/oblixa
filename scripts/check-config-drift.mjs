#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const ci = readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");

const checks = [
  "check:api-route-tests",
  "check:owner-metadata",
  "check:hardening-debt-ratchet",
  "check:incident-readiness",
  "check:integration-contract-resilience",
  "check:concurrency-hotspots-ratchet",
];

const issues = [];
for (const c of checks) {
  if (!pkg.scripts?.[c]) issues.push({ issue: "missing_package_script", script: c });
  if (!ci.includes(`npm run ${c}`) && !ci.includes(`npm run ${c.replace("check:", "report:")}`)) {
    issues.push({ issue: "missing_ci_reference", script: c });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
