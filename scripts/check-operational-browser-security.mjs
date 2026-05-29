#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeBrowserIsolationHeaders } from "./check-browser-isolation-headers.mjs";
import { analyzeClientBundleSecretLeakage } from "./check-client-bundle-secret-leakage.mjs";
import { analyzeClientStorageSensitivity } from "./check-client-storage-sensitivity.mjs";
import { analyzeCspNonceHashConsistency } from "./check-csp-nonce-hash-consistency.mjs";
import { analyzeNextPublicSurface } from "./check-next-public-surface.mjs";
import { analyzePermissionsPolicySecurity } from "./check-permissions-policy-security.mjs";
import { analyzeReportingEndpoints } from "./check-reporting-endpoints.mjs";
import { analyzeSecurityHeaders } from "./check-security-headers.mjs";
import { analyzeSensitiveCacheControls } from "./check-sensitive-cache-controls.mjs";
import { analyzeSensitiveUrlPropagation } from "./check-sensitive-url-propagation.mjs";
import { analyzeXssClientExposure } from "./check-xss-client-exposure.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-browser-security.json";
const ARTIFACT_REL = "artifacts/operational-browser-security.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");
const CI_ONLY_SIGNAL_CHECKS = new Set([
  "check:client-cache-sensitivity",
  "check:content-sniffing-defenses",
  "check:third-party-script-integrity",
  "check:unsafe-inline-regressions",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

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

function normalizeReport(checkId, report) {
  return {
    checkId,
    ok: Boolean(report.ok ?? report.issueCount === 0),
    issueCount: Number(report.issueCount ?? report.issues?.length ?? report.errors?.length ?? 0),
  };
}

function validateCommands(root, config, packageScripts, ci, securityPipeline, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      const securityPipelineRequired = script.startsWith("check:") && !CI_ONLY_SIGNAL_CHECKS.has(script);
      const securityPipelinePresent = script.startsWith("check:")
        ? securityPipeline.includes(`"${script}"`)
        : null;
      if (!packageScriptPresent) {
        issues.push(issue("operational_browser_security_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_browser_security_missing_ci_command", { objective: objective.id, script }));
      }
      if (securityPipelineRequired && securityPipelinePresent !== true) {
        issues.push(issue("operational_browser_security_missing_security_pipeline_step", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        securityPipelineRequired,
        securityPipelinePresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }
    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_browser_security_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }
  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function validateMarkerRows(root, rows, issuePrefix, issues) {
  const markerRows = [];
  for (const markerFile of rows ?? []) {
    const text = read(root, markerFile.path);
    const missing = [];
    if (!text) {
      missing.push(...(markerFile.markers ?? []));
      issues.push(issue(`${issuePrefix}_missing_marker_file`, { id: markerFile.id, path: markerFile.path }));
    } else {
      for (const marker of markerFile.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { id: markerFile.id, path: markerFile.path, marker }));
        }
      }
    }
    markerRows.push({
      id: markerFile.id,
      path: markerFile.path,
      markerCount: markerFile.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }
  return markerRows.sort((a, b) => a.id.localeCompare(b.id));
}

function collectRouteFamilyCoverage(root, config, issues) {
  const e2e = read(root, "e2e/security-headers-smoke.spec.ts");
  const rows = [];
  const seen = new Set();
  for (const family of config.routeFamilies ?? []) {
    if (seen.has(family.id)) issues.push(issue("operational_browser_security_duplicate_route_family", { id: family.id }));
    seen.add(family.id);
    const missingMarkers = [];
    for (const marker of family.e2eMarkers ?? []) {
      if (!e2e.includes(marker)) {
        missingMarkers.push(marker);
        issues.push(issue("operational_browser_security_route_family_missing_smoke_marker", {
          id: family.id,
          marker,
        }));
      }
    }
    if (!Array.isArray(family.requiredHeaders) || family.requiredHeaders.length === 0) {
      issues.push(issue("operational_browser_security_route_family_headers_missing", { id: family.id }));
    }
    rows.push({
      id: family.id,
      representativePath: family.representativePath,
      requiredHeaders: [...(family.requiredHeaders ?? [])].sort((a, b) => a.localeCompare(b)),
      requiredHeaderCount: family.requiredHeaders?.length ?? 0,
      e2eMarkerCount: family.e2eMarkers?.length ?? 0,
      missingMarkerCount: missingMarkers.length,
      ok: missingMarkers.length === 0 && (family.requiredHeaders?.length ?? 0) > 0,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function collectReportingEndpointReadiness(root, config, issues) {
  const row = config.reportingEndpoint ?? {};
  const routeText = read(root, row.routeFile ?? "");
  const testText = read(root, row.testFile ?? "");
  const artifactExists = Boolean(row.artifact && fs.existsSync(path.join(root, row.artifact)));
  if (row.path !== "/api/security/csp-report") {
    issues.push(issue("operational_browser_security_unexpected_reporting_endpoint_path", { path: row.path ?? null }));
  }
  if (row.group !== "csp-endpoint") {
    issues.push(issue("operational_browser_security_unexpected_reporting_endpoint_group", { group: row.group ?? null }));
  }
  if (!routeText.includes("CSP_REPORT_BODY_LIMIT") || !routeText.includes("private, no-store")) {
    issues.push(issue("operational_browser_security_reporting_endpoint_route_not_bounded", { path: row.routeFile ?? null }));
  }
  if (!testText.includes("accepts bounded CSP reports") || !testText.includes("rejects malformed report shapes")) {
    issues.push(issue("operational_browser_security_reporting_endpoint_tests_missing", { path: row.testFile ?? null }));
  }
  if (!artifactExists) {
    issues.push(issue("operational_browser_security_reporting_endpoint_artifact_missing", { path: row.artifact ?? null }));
  }
  return {
    path: row.path ?? null,
    group: row.group ?? null,
    routeFile: row.routeFile ?? null,
    testFile: row.testFile ?? null,
    artifact: row.artifact ?? null,
    routeBounded: routeText.includes("CSP_REPORT_BODY_LIMIT") && routeText.includes("private, no-store"),
    testsCovered: testText.includes("accepts bounded CSP reports") && testText.includes("rejects malformed report shapes"),
    artifactExists,
  };
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("browser-isolation-headers", analyzeBrowserIsolationHeaders(root)),
    normalizeReport("client-bundle-secret-leakage", analyzeClientBundleSecretLeakage(root)),
    normalizeReport("client-storage-sensitivity", analyzeClientStorageSensitivity(root)),
    normalizeReport("csp-nonce-hash-consistency", analyzeCspNonceHashConsistency(root)),
    normalizeReport("next-public-surface", analyzeNextPublicSurface(root)),
    normalizeReport("permissions-policy-security", analyzePermissionsPolicySecurity(root)),
    normalizeReport("reporting-endpoints", analyzeReportingEndpoints(root)),
    normalizeReport("security-headers", analyzeSecurityHeaders(root)),
    normalizeReport("sensitive-cache-controls", analyzeSensitiveCacheControls(root)),
    normalizeReport("sensitive-url-propagation", analyzeSensitiveUrlPropagation(root)),
    normalizeReport("xss-client-exposure", analyzeXssClientExposure(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_browser_security_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalBrowserSecurityReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-browser-security") {
    issues.push(issue("operational_browser_security_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, securityPipeline, issues);
  const routeFamilies = collectRouteFamilyCoverage(root, config, issues);
  const cspRolloutContracts = validateMarkerRows(root, config.cspRolloutContracts ?? [], "operational_browser_security_csp_rollout", issues);
  const clientLeakageSurfaces = validateMarkerRows(root, config.clientLeakageSurfaces ?? [], "operational_browser_security_client_leakage", issues);
  const browserSmokeContracts = validateMarkerRows(root, config.browserSmokeContracts ?? [], "operational_browser_security_smoke", issues);
  const reportingEndpoint = collectReportingEndpointReadiness(root, config, issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-browser-security",
    generatedBy: "scripts/check-operational-browser-security.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    routeFamilyCount: routeFamilies.length,
    cspRolloutContractCount: cspRolloutContracts.length,
    clientLeakageSurfaceCount: clientLeakageSurfaces.length,
    browserSmokeContractCount: browserSmokeContracts.length,
    delegatedCheckCount: checks.length,
    commands,
    routeFamilies,
    cspRolloutContracts,
    clientLeakageSurfaces,
    browserSmokeContracts,
    reportingEndpoint,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalBrowserSecurity(root = ROOT) {
  const report = buildOperationalBrowserSecurityReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_browser_security_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_browser_security_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-browser-security",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function runOperationalBrowserSecurity(root = ROOT) {
  const report = buildOperationalBrowserSecurityReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }

  const checked = analyzeOperationalBrowserSecurity(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalBrowserSecurity();
}
