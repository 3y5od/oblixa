#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:browser-isolation-headers"];
const REQUIRED_CI_COMMANDS = ["npm run check:browser-isolation-headers"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:browser-isolation-headers"'];
const REQUIRED_FILE_MARKERS = {
  "next.config.ts": [
    'buildSecurityHeaders, normalizeCoepMode, normalizeTrustedTypesMode',
    "const securityHeaders = buildSecurityHeaders({",
    'source: "/:path*"',
    "headers: securityHeaders",
  ],
  "src/lib/security/csp-builders.ts": [
    'key: "Cross-Origin-Opener-Policy", value: "same-origin"',
    'key: "Cross-Origin-Resource-Policy", value: "same-origin"',
    'key: "Cross-Origin-Embedder-Policy", value: coepMode',
    'key: "X-Frame-Options", value: "DENY"',
    "normalizeTrustedTypesMode",
    "normalizeCoepMode",
    "trustedTypesMode === \"enforce\"",
    "script-src-attr 'none'",
    "upgrade-insecure-requests",
  ],
  "src/lib/security/csp-builders.test.ts": [
    "prod CSP omits unsafe-eval in main policy",
    "frame-ancestors 'none'",
    "report-only CSP carries script attribute and mixed-content protections",
    "Trusted Types can be enforced on the main CSP with an explicit mode",
    "COEP compatibility gate supports off, credentialless, and require-corp",
  ],
  "src/app/api/security/csp-report/route.ts": [
    "CSP_REPORT_BODY_LIMIT",
    "normalizeCspReportBody(parsed)",
    "rateLimitCheck(`csp-report:${ip}`",
    "private, no-store",
    "[security-event:csp-report]",
  ],
  "src/app/api/security/csp-report/route.test.ts": [
    "accepts bounded CSP reports, logs redacted security event, and returns no-store 204",
    "rejects unsupported content types",
    "rejects malformed report shapes",
  ],
  "e2e/security-headers-smoke.spec.ts": [
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
    "framing defenses are explicit for clickjacking protection",
    "frame-ancestors 'none'",
    "script-src-attr 'none'",
    "upgrade-insecure-requests",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeBrowserIsolationHeaders(root = ROOT) {
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

  return { checkId: "browser-isolation-headers", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeBrowserIsolationHeaders();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
