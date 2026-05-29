#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:csp-nonce-hash-consistency"];
const REQUIRED_CI_COMMANDS = ["npm run check:csp-nonce-hash-consistency"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:csp-nonce-hash-consistency"'];

const NEXT_CONFIG_MARKERS = [
  "OBLIXA_CSP_REPORT_ONLY_SCRIPT_NONCE",
  "OBLIXA_TRUSTED_TYPES_REPORT_ONLY",
  "OBLIXA_CSP_STRICT_ENFORCING_STYLE",
  "OBLIXA_CSP_STRICT_ENFORCING_SCRIPT",
  "OBLIXA_CSP_ENFORCING_SCRIPT_HASHES",
  "cspStrictEnforcingScriptSrc:",
  "cspEnforcingScriptHashes:",
];

const BUILDER_MARKERS = [
  "normalizeCspScriptHashSources",
  "normalizeCspScriptNonce",
  "CSP_SCRIPT_HASH_SOURCE_RE",
  "CSP_NONCE_SOURCE_RE",
  "strictEnforcingScriptSrc",
  "enforcingScriptHashes",
  "Content-Security-Policy",
  "Content-Security-Policy-Report-Only",
  "appendCspReportingDirectives",
  "report-uri ${SECURITY_REPORTING_ENDPOINT_PATH}",
  "report-to ${SECURITY_REPORTING_ENDPOINT_GROUP}",
  "require-trusted-types-for 'script'",
  "script-src-attr 'none'",
  "upgrade-insecure-requests",
];

const BUILDER_TEST_MARKERS = [
  "prod script-src drops unsafe-inline on enforcing CSP by default",
  "strict prod script-src accepts configured hashes for inline rollout",
  "prod enforcing CSP supports explicit unsafe-inline rollback flags",
  "invalid configured CSP script hash sources fail closed",
  "invalid report-only CSP nonce sources fail closed",
  "report-only CSP can use script nonce when provided (staged)",
  "report-only CSP carries script attribute and mixed-content protections",
  "buildSecurityHeaders wires CSP report-uri and report-to endpoints",
  "optional Trusted Types directive appended to report-only CSP when enabled",
];

const E2E_MARKERS = [
  "root CSP carries enforcing and report-only browser isolation directives",
  "content-security-policy-report-only",
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "script-src-attr 'none'",
  "upgrade-insecure-requests",
  "script-src 'self'",
  "report-uri /api/security/csp-report",
  "report-to csp-endpoint",
  "not.toContain(\"'unsafe-inline'\")",
];

function readIfExists(root, rel, issues) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    issues.push({ issue: "missing_required_file", rel });
    return "";
  }
  return fs.readFileSync(abs, "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function requireMarkers(issues, rel, content, markers, issue = "missing_marker") {
  for (const marker of collectMissingMarkers(content, markers)) {
    issues.push({ issue, rel, marker });
  }
}

function sectionBetween(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start === -1) return "";
  const end = content.indexOf(endMarker, start + startMarker.length);
  return content.slice(start, end === -1 ? content.length : end);
}

export function analyzeCspNonceHashConsistency(root = ROOT) {
  const issues = [];

  const pkg = JSON.parse(readIfExists(root, "package.json", issues) || "{}");
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = readIfExists(root, ".github/workflows/ci.yml", issues);
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = readIfExists(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", issues);
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  const nextConfig = readIfExists(root, "next.config.ts", issues);
  requireMarkers(issues, "next.config.ts", nextConfig, NEXT_CONFIG_MARKERS);

  const builder = readIfExists(root, "src/lib/security/csp-builders.ts", issues);
  requireMarkers(issues, "src/lib/security/csp-builders.ts", builder, BUILDER_MARKERS);

  const strictReportOnly = sectionBetween(
    builder,
    "export function buildStrictCspReportOnly",
    "let memoCspKey"
  );
  if (!strictReportOnly) {
    issues.push({ issue: "missing_strict_report_only_builder", rel: "src/lib/security/csp-builders.ts" });
  } else {
    if (strictReportOnly.includes("'unsafe-inline'")) {
      issues.push({
        issue: "report_only_csp_allows_unsafe_inline",
        rel: "src/lib/security/csp-builders.ts",
      });
    }
    for (const directive of ["default-src 'self'", "script-src 'self'", "style-src 'self'"]) {
      if (!strictReportOnly.includes(directive)) {
        issues.push({
          issue: "report_only_csp_missing_strict_directive",
          rel: "src/lib/security/csp-builders.ts",
          directive,
        });
      }
    }
    if (!strictReportOnly.includes("script-src-attr 'none'")) {
      issues.push({
        issue: "report_only_csp_missing_script_attr_block",
        rel: "src/lib/security/csp-builders.ts",
      });
    }
  }

  const enforcingScriptBuilder = sectionBetween(
    builder,
    "function buildEnforcingScriptSrc",
    "export function buildStrictCspReportOnly"
  );
  if (!enforcingScriptBuilder) {
    issues.push({ issue: "missing_enforcing_script_builder", rel: "src/lib/security/csp-builders.ts" });
  } else {
    if (!enforcingScriptBuilder.includes("options?.strictEnforcingScriptSrc !== false")) {
      issues.push({ issue: "missing_strict_enforcing_script_toggle", rel: "src/lib/security/csp-builders.ts" });
    }
    if (
      !enforcingScriptBuilder.includes("normalizeCspScriptHashSources(options.enforcingScriptHashes)") &&
      !enforcingScriptBuilder.includes("normalizeCspScriptHashSources(options?.enforcingScriptHashes)")
    ) {
      issues.push({ issue: "missing_enforcing_script_hash_normalization", rel: "src/lib/security/csp-builders.ts" });
    }
    if (!enforcingScriptBuilder.includes("script-src 'self' 'unsafe-inline'")) {
      issues.push({ issue: "missing_default_inline_compatibility_path", rel: "src/lib/security/csp-builders.ts" });
    }
  }

  const builderTest = readIfExists(root, "src/lib/security/csp-builders.test.ts", issues);
  requireMarkers(issues, "src/lib/security/csp-builders.test.ts", builderTest, BUILDER_TEST_MARKERS, "missing_test_marker");

  const e2e = readIfExists(root, "e2e/security-headers-smoke.spec.ts", issues);
  requireMarkers(issues, "e2e/security-headers-smoke.spec.ts", e2e, E2E_MARKERS, "missing_e2e_marker");

  return { checkId: "csp-nonce-hash-consistency", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeCspNonceHashConsistency();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
