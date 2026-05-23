#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const POLICY_PATH = path.join("artifacts", "dependency-review-policy.json");
const REQUIRED_CHECKS = [
  "check:dependency-policy",
  "check:lockfile-integrity-drift",
  "check:sbom-integrity",
  "check:license-sbom",
  "check:install-script-risk",
  "check:npm-script-integrity",
  "check:npm-lifecycle",
  "check:dynamic-import-specifiers",
  "check:unsafe-deserialization",
  "check:release-artifact-provenance",
];
const REQUIRED_ARTIFACTS = [
  "package-lock.json",
  "cyclonedx-sbom.json",
  "artifacts/license-allowlist.json",
  "artifacts/supply-chain-install-script-allowlist.json",
  "artifacts/dependency-review-policy.json",
];
const REQUIRED_CI_SNIPPETS = [
  "npm run check:dependency-policy",
  "npm run check:lockfile-integrity-drift",
  "npm run check:sbom-integrity",
  "npm run check:license-sbom",
  "npm run check:install-script-risk",
  "npm run check:npm-script-integrity",
  "npm run check:npm-lifecycle",
  "npm run check:dynamic-import-specifiers",
  "npm run check:unsafe-deserialization",
  "npm run check:release-artifact-provenance",
  "actions/upload-artifact",
  "cyclonedx-sbom.json",
  "npm run report:dependency-risk",
];
const REQUIRED_SECURITY_PIPELINE_STEPS = REQUIRED_CHECKS.map((script) => `"${script}"`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function hasAll(container, required) {
  const values = new Set(Array.isArray(container) ? container : []);
  return required.filter((item) => !values.has(item));
}

export function analyzeDependencyPolicy(root = process.cwd()) {
  const pkgPath = path.join(root, "package.json");
  const policyPath = path.join(root, POLICY_PATH);
  const ciPath = path.join(root, ".github", "workflows", "ci.yml");
  const securityPipelinePath = path.join(root, "scripts", "pipelines", "pipeline-security-comprehensive.mjs");
  const issues = [];

  if (!fs.existsSync(pkgPath)) issues.push({ issue: "missing_package_json" });
  if (!fs.existsSync(policyPath)) issues.push({ issue: "missing_dependency_review_policy", path: POLICY_PATH });
  if (!fs.existsSync(ciPath)) issues.push({ issue: "missing_ci_workflow", path: ".github/workflows/ci.yml" });
  if (!fs.existsSync(securityPipelinePath)) {
    issues.push({ issue: "missing_security_pipeline", path: "scripts/pipelines/pipeline-security-comprehensive.mjs" });
  }
  if (issues.length) return { checkId: "dependency-policy", ok: false, issueCount: issues.length, issues };

  const pkg = readJson(pkgPath);
  const policy = readJson(policyPath);
  const ci = fs.readFileSync(ciPath, "utf8");
  const securityPipeline = fs.readFileSync(securityPipelinePath, "utf8");

  if (policy.version !== 1) issues.push({ issue: "invalid_dependency_policy_version", version: policy.version });
  if (!["high", "critical"].includes(policy.failOnSeverity)) {
    issues.push({ issue: "invalid_dependency_policy_severity", failOnSeverity: policy.failOnSeverity });
  }
  for (const check of REQUIRED_CHECKS) {
    if (!pkg.scripts?.[check]) issues.push({ issue: "missing_package_script", script: check });
  }
  for (const check of hasAll(policy.requiredChecks, REQUIRED_CHECKS)) {
    issues.push({ issue: "dependency_policy_missing_required_check", check });
  }
  for (const artifact of hasAll(policy.requiredArtifacts, REQUIRED_ARTIFACTS)) {
    issues.push({ issue: "dependency_policy_missing_required_artifact", artifact });
  }
  for (const snippet of REQUIRED_CI_SNIPPETS) {
    if (!ci.includes(snippet)) issues.push({ issue: "missing_ci_dependency_policy_snippet", snippet });
  }
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_supply_chain_step", script: step.replaceAll('"', "") });
    }
  }
  if (!policy.dependencyReview || policy.dependencyReview.mode !== "artifact-and-audit") {
    issues.push({ issue: "dependency_review_artifact_mode_required" });
  }
  if (typeof policy.dependencyReview?.reason !== "string" || policy.dependencyReview.reason.trim().length < 24) {
    issues.push({ issue: "dependency_review_reason_required" });
  }

  return {
    checkId: "dependency-policy",
    ok: issues.length === 0,
    requiredCheckCount: REQUIRED_CHECKS.length,
    requiredArtifactCount: REQUIRED_ARTIFACTS.length,
    issueCount: issues.length,
    issues: issues.slice(0, 80),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeDependencyPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
