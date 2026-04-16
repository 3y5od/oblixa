#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ciPath = path.join(ROOT, ".github/workflows/ci.yml");
const ci = readFileSync(ciPath, "utf8");

const expectedJobs = [
  "quality_static_security:",
  "quality_static_surface:",
  "quality_static_governance:",
  "quality_static_codehealth:",
  "quality_unit:",
  "quality_security:",
  "quality_build_e2e:",
  "quality:",
];
const issues = [];
for (const job of expectedJobs) {
  if (!ci.includes(job)) issues.push({ issue: "missing_job", job });
}

if (
  !ci.includes(
    "needs: [quality_static_security, quality_static_surface, quality_static_governance, quality_static_codehealth, quality_unit, quality_security, quality_build_e2e]"
  )
) {
  issues.push({ issue: "quality_needs_drift" });
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
