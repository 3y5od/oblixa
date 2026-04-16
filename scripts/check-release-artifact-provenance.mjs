#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const releaseChecklist = fs.readFileSync(
  path.join(root, "scripts", "pipelines", "pipeline-release-checklist.mjs"),
  "utf8"
);

const issues = [];

for (const signal of [
  "actions/checkout@",
  "actions/setup-node@",
  "osv-scanner-action",
  "gitleaks-action@",
]) {
  if (!ci.includes(signal)) {
    issues.push({ issue: "missing_ci_provenance_signal", signal });
  }
}

for (const cmd of ["preflight:release", "verify", "check:comprehensive-pass", "test:e2e"]) {
  if (!releaseChecklist.includes(cmd)) {
    issues.push({ issue: "missing_release_checklist_step", cmd });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
