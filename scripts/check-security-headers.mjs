#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:security-headers"];
const REQUIRED_CI_COMMANDS = ["npm run check:security-headers"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:security-headers"'];
const REQUIRED_HEADER_KEYS = [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Content-Security-Policy",
  "Content-Security-Policy-Report-Only",
  "Strict-Transport-Security",
];
const NEXT_CONFIG_MARKERS = [
  'import { buildSecurityHeaders } from "@/lib/security/csp-builders"',
  "const securityHeaders = buildSecurityHeaders({",
  'source: "/api/:path*"',
  'source: "/:path*"',
  "headers: securityHeaders",
  '{ key: "Cache-Control", value: "private, no-store" }',
];
const CSP_TEST_MARKERS = [
  "buildSecurityHeaders adds HSTS only on Vercel by default",
  "Permissions-Policy disables payment and capture surfaces unless product opts in later",
  'require-trusted-types-for \'script\'',
];

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeSecurityHeaders(root = ROOT) {
  const issues = [];
  const requiredFiles = ["next.config.ts", "src/lib/security/csp-builders.ts", "src/lib/security/csp-builders.test.ts"];
  for (const rel of requiredFiles) {
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
    if (!securityPipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }

  const nextConfig = read(root, "next.config.ts");
  for (const marker of collectMissingMarkers(nextConfig, NEXT_CONFIG_MARKERS)) {
    issues.push({ issue: "missing_next_config_marker", marker });
  }

  const cspBuilders = read(root, "src/lib/security/csp-builders.ts");
  for (const key of REQUIRED_HEADER_KEYS) {
    if (!cspBuilders.includes(`key: "${key}"`)) issues.push({ issue: "missing_security_header_key", key });
  }

  const cspTests = read(root, "src/lib/security/csp-builders.test.ts");
  for (const marker of collectMissingMarkers(cspTests, CSP_TEST_MARKERS)) {
    issues.push({ issue: "missing_header_test_marker", marker });
  }

  return { checkId: "security-headers", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSecurityHeaders();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
