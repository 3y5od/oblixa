#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REPORTING_ENDPOINT_PATH = "/api/security/csp-report";
const REPORTING_ENDPOINT_GROUP = "csp-endpoint";
const REQUIRED_PACKAGE_SCRIPTS = ["check:reporting-endpoints"];
const REQUIRED_CI_COMMANDS = ["npm run check:reporting-endpoints"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:reporting-endpoints"'];
const REQUIRED_MARKERS = {
  "src/lib/security/csp-builders.ts": [
    "SECURITY_REPORTING_ENDPOINT_GROUP",
    "SECURITY_REPORTING_ENDPOINT_PATH",
    "appendCspReportingDirectives",
    "buildReportingEndpointsHeader",
    "report-uri ${SECURITY_REPORTING_ENDPOINT_PATH}",
    "report-to ${SECURITY_REPORTING_ENDPOINT_GROUP}",
    'key: "Reporting-Endpoints"',
  ],
  "src/lib/security/csp-builders.test.ts": [
    "buildSecurityHeaders wires CSP report-uri and report-to endpoints",
    "report-uri /api/security/csp-report",
    "report-to csp-endpoint",
    "Reporting-Endpoints",
  ],
  "src/app/api/security/csp-report/route.ts": [
    "CSP_REPORT_BODY_LIMIT",
    "application/reports+json",
    "normalizeCspReportBody(parsed)",
    "formatCspReportForSecurityLog(report)",
    "private, no-store",
  ],
  "src/app/api/security/csp-report/route.test.ts": [
    "accepts bounded CSP reports, logs redacted security event, and returns no-store 204",
    "rejects unsupported content types",
    "rejects malformed report shapes",
  ],
  "e2e/security-headers-smoke.spec.ts": [
    "report-uri /api/security/csp-report",
    "report-to csp-endpoint",
  ],
};

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel) {
  const text = read(root, rel);
  if (!text) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(text);
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function commandText(script) {
  return `npm run ${script}`;
}

function validateMarkers(root, issues) {
  const rows = [];
  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    const text = read(root, rel);
    const missing = [];
    if (!text) {
      missing.push(...markers);
      issues.push(issue("reporting_endpoints_missing_required_file", { rel }));
    } else {
      for (const marker of markers) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue("reporting_endpoints_missing_marker", { rel, marker }));
        }
      }
    }
    rows.push({ rel, markerCount: markers.length, missingCount: missing.length, ok: missing.length === 0 });
  }
  return rows.sort((a, b) => a.rel.localeCompare(b.rel));
}

function validatePackageCiPipeline(root, issues) {
  const scripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, ".github/workflows/ci.yml");
  const pipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  const rows = [];

  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    const packageScriptPresent = Boolean(scripts[script]);
    const ciPresent = ci.includes(commandText(script));
    const pipelinePresent = pipeline.includes(`"${script}"`);
    if (!packageScriptPresent) issues.push(issue("reporting_endpoints_missing_package_script", { script }));
    if (!ciPresent) issues.push(issue("reporting_endpoints_missing_ci_command", { script }));
    if (!pipelinePresent) issues.push(issue("reporting_endpoints_missing_security_pipeline_step", { script }));
    rows.push({ script, packageScriptPresent, ciPresent, pipelinePresent });
  }

  for (const command of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(command)) issues.push(issue("reporting_endpoints_missing_ci_reference", { command }));
  }
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!pipeline.includes(step)) {
      issues.push(issue("reporting_endpoints_missing_pipeline_reference", { step: step.replaceAll('"', "") }));
    }
  }

  return rows;
}

function validateStub(root, issues) {
  const rel = "artifacts/reporting-endpoints-stub.json";
  let stub;
  try {
    stub = readJson(root, rel);
  } catch (error) {
    issues.push(issue("reporting_endpoints_stub_missing_or_invalid", { rel, error: String(error.message ?? error) }));
    return { path: rel, ok: false };
  }

  const endpoints = Array.isArray(stub.reportingEndpoints) ? stub.reportingEndpoints : [];
  const matchingEndpoint = endpoints.find((entry) => entry.group === REPORTING_ENDPOINT_GROUP);
  if (!matchingEndpoint) {
    issues.push(issue("reporting_endpoints_stub_missing_group", { group: REPORTING_ENDPOINT_GROUP }));
  }
  const urls = (matchingEndpoint?.endpoints ?? []).map((entry) => String(entry.url ?? ""));
  const hasExpectedPath = urls.some((url) => {
    try {
      return new URL(url, "https://oblixa.example").pathname === REPORTING_ENDPOINT_PATH;
    } catch {
      return false;
    }
  });
  if (!hasExpectedPath) {
    issues.push(issue("reporting_endpoints_stub_missing_expected_path", { expectedPath: REPORTING_ENDPOINT_PATH }));
  }

  const nel = stub.nel ?? null;
  if (nel) {
    if (nel.report_to !== REPORTING_ENDPOINT_GROUP) {
      issues.push(issue("reporting_endpoints_stub_nel_group_mismatch", {
        expected: REPORTING_ENDPOINT_GROUP,
        actual: nel.report_to ?? null,
      }));
    }
    if (!Number.isInteger(nel.max_age) || nel.max_age < 0 || nel.max_age > 2_592_000) {
      issues.push(issue("reporting_endpoints_stub_nel_max_age_invalid", { maxAge: nel.max_age ?? null }));
    }
  }

  return {
    path: rel,
    ok: Boolean(matchingEndpoint && hasExpectedPath),
    group: matchingEndpoint?.group ?? null,
    endpointCount: urls.length,
    nelPresent: Boolean(nel),
  };
}

export function analyzeReportingEndpoints(root = ROOT) {
  const issues = [];
  const markerRows = validateMarkers(root, issues);
  const commandRows = validatePackageCiPipeline(root, issues);
  const stub = validateStub(root, issues);
  const builder = read(root, "src/lib/security/csp-builders.ts");

  const hasReportingEndpointsHeader = builder.includes('key: "Reporting-Endpoints"');
  const hasCspReportUri = builder.includes("report-uri ${SECURITY_REPORTING_ENDPOINT_PATH}");
  const hasCspReportTo = builder.includes("report-to ${SECURITY_REPORTING_ENDPOINT_GROUP}");

  return {
    checkId: "reporting-endpoints",
    ok: issues.length === 0,
    reportingEndpointGroup: REPORTING_ENDPOINT_GROUP,
    reportingEndpointPath: REPORTING_ENDPOINT_PATH,
    hasReportingEndpointsHeader,
    hasCspReportUri,
    hasCspReportTo,
    commandRows,
    markerRows,
    stub,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeReportingEndpoints();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
