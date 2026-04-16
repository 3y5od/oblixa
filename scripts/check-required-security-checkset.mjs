#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const verifyPipeline = fs.readFileSync(
  path.join(root, "scripts", "pipelines", "pipeline-verify.mjs"),
  "utf8"
);
const securityPipeline = fs.readFileSync(
  path.join(root, "scripts", "pipelines", "pipeline-security-comprehensive.mjs"),
  "utf8"
);
const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

const requiredScripts = [
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
  "check:cron-route-auth",
  "check:security-env-contract",
  "check:required-security-checkset",
  "check:type-lint-ratchet",
  "check:test-skip-governance",
];

const issues = [];
for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) {
    issues.push({ issue: "missing_package_script", script });
  }
}

for (const script of [
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
]) {
  if (!verifyPipeline.includes(`"${script}"`) && !verifyPipeline.includes(`'${script}'`)) {
    issues.push({ issue: "missing_verify_pipeline_step", script });
  }
  if (!securityPipeline.includes(`"${script}"`) && !securityPipeline.includes(`'${script}'`)) {
    issues.push({ issue: "missing_security_pipeline_step", script });
  }
}

for (const cmd of [
  "npm run check:api-route-auth-contract",
  "npm run check:api-route-admin-org-scope",
  "npm run check:server-action-auth-contract",
  "npm run check:server-action-org-scope",
  "npm run check:server-action-exports",
  "npm run check:cron-route-auth",
  "npm run check:type-lint-ratchet",
  "npm run check:test-skip-governance",
]) {
  if (!ci.includes(cmd)) {
    issues.push({ issue: "missing_ci_reference", cmd });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
