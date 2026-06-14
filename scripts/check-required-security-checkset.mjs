#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { CI_PARITY_STEPS } from "./pipelines/pipeline-ci-parity.mjs";
import { SECURITY_COMPREHENSIVE_STEPS } from "./pipelines/pipeline-security-comprehensive.mjs";
import { VERIFY_DOMAIN_PASS_STEPS, VERIFY_FIRST_PASS_STEPS, VERIFY_PARITY_STEPS } from "./pipelines/pipeline-verify.mjs";

import { CI_REQUIRED_COMMANDS, RELEASE_GATE_QUALITY_TAIL, REQUIRED_SECURITY_CHECK_SCRIPTS, SECURITY_PIPELINE_REQUIRED, VERIFY_PIPELINE_REQUIRED } from "./lib/required-security-checkset-requirements.mjs";
export { REQUIRED_SECURITY_CHECK_SCRIPTS, SECURITY_PIPELINE_REQUIRED, VERIFY_PIPELINE_REQUIRED } from "./lib/required-security-checkset-requirements.mjs";

function normalizePipelineStep(step) {
  return typeof step === "string" ? { script: step, required: true } : { script: step.script, required: step.required !== false };
}

export function analyzeRequiredSecurityCheckset(root = process.cwd()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  const issues = [];
  const verifySteps = new Set([...VERIFY_FIRST_PASS_STEPS, ...VERIFY_DOMAIN_PASS_STEPS, ...VERIFY_PARITY_STEPS]);
  const securityStepEntries = SECURITY_COMPREHENSIVE_STEPS.map(normalizePipelineStep);
  const securitySteps = new Set(securityStepEntries.map((entry) => entry.script));
  const requiredSecuritySteps = new Set(securityStepEntries.filter((entry) => entry.required).map((entry) => entry.script));
  const paritySteps = new Set(CI_PARITY_STEPS);

  for (const script of REQUIRED_SECURITY_CHECK_SCRIPTS) {
    if (!pkg.scripts?.[script]) {
      issues.push({ issue: "missing_package_script", script });
    }
  }

  for (const script of VERIFY_PIPELINE_REQUIRED) {
    if (!verifySteps.has(script)) {
      issues.push({ issue: "missing_verify_pipeline_step", script });
    }
  }

  for (const script of SECURITY_PIPELINE_REQUIRED) {
    if (!securitySteps.has(script)) {
      issues.push({ issue: "missing_security_pipeline_step", script });
    } else if (!requiredSecuritySteps.has(script)) {
      issues.push({ issue: "non_required_security_pipeline_step", script });
    }
  }

  if (pkg.scripts?.["security:sweep:comprehensive"] !== "node scripts/pipelines/pipeline-security-comprehensive.mjs") {
    issues.push({ issue: "security_sweep_not_bound_to_comprehensive_pipeline" });
  }

  if (!pkg.scripts?.["verify:security"]?.includes("security:sweep:comprehensive")) {
    issues.push({ issue: "verify_security_not_bound_to_comprehensive_sweep" });
  }

  for (const script of RELEASE_GATE_QUALITY_TAIL) {
    if (!pkg.scripts?.[script]) {
      issues.push({ issue: "missing_release_quality_gate_script", script });
    }
  }

  const requiredStepScripts = securityStepEntries.filter((entry) => entry.required).map((entry) => entry.script);
  const actualTail = requiredStepScripts.slice(-RELEASE_GATE_QUALITY_TAIL.length);
  if (JSON.stringify(actualTail) !== JSON.stringify(RELEASE_GATE_QUALITY_TAIL)) {
    issues.push({
      issue: "comprehensive_pipeline_quality_tail_mismatch",
      expected: RELEASE_GATE_QUALITY_TAIL,
      actual: actualTail,
    });
  }

  for (const script of [
    "check:github-workflows-security",
    "check:e2e:skip-baseline",
    "check:semgrep-rulepack-integrity",
    "check:wrapper-reintroduction",
  ]) {
    if (!paritySteps.has(script)) {
      issues.push({ issue: "missing_ci_parity_pipeline_step", script });
    }
  }

  for (const cmd of CI_REQUIRED_COMMANDS) {
    if (!ci.includes(cmd)) {
      issues.push({ issue: "missing_ci_reference", cmd });
    }
  }

  return { issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRequiredSecurityCheckset();
  console.log(JSON.stringify(report, null, 2));
  if (report.issueCount > 0) process.exit(1);
}
