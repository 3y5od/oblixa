#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:permissions-policy-security"];
const REQUIRED_CI_COMMANDS = ["npm run check:permissions-policy-security"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:permissions-policy-security"'];
const REQUIRED_POLICY_TOKENS = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "display-capture=()",
  "web-share=()",
  "interest-cohort=()",
  "usb=()",
  "bluetooth=()",
  "serial=()",
  "hid=()",
];
const REQUIRED_FILE_MARKERS = {
  "next.config.ts": ['import { buildSecurityHeaders } from "@/lib/security/csp-builders"', "headers: securityHeaders"],
  "src/lib/security/csp-builders.ts": ['key: "Permissions-Policy"'],
  "src/lib/security/csp-builders.test.ts": [
    "Permissions-Policy disables payment and capture surfaces unless product opts in later",
    "payment=()",
    "display-capture=()",
  ],
  "e2e/security-headers-smoke.spec.ts": ["Permissions-Policy present on root (soft)"],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzePermissionsPolicySecurity(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fs.existsSync(path.join(root, rel))) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  const cspBuilders = read(root, "src/lib/security/csp-builders.ts");
  for (const token of REQUIRED_POLICY_TOKENS) {
    if (!cspBuilders.includes(token)) issues.push({ issue: "missing_permissions_policy_token", token });
  }

  return { checkId: "permissions-policy-security", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePermissionsPolicySecurity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
