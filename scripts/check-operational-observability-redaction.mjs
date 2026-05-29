#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeAiContextRedaction } from "./check-ai-context-redaction.mjs";
import { analyzeCiArtifactSecretLeakage } from "./check-ci-artifact-secret-leakage.mjs";
import { analyzeLoggingTelemetryRedaction } from "./check-logging-telemetry-redaction.mjs";
import { analyzeNotificationPayloadScrubContract } from "./check-notification-payload-scrub-contract.mjs";
import { analyzePersistenceRedaction } from "./check-persistence-redaction.mjs";
import { analyzeReportRedactionContract } from "./check-report-redaction-contract.mjs";
import { analyzeSecurityReportChecksums } from "./check-security-report-checksums.mjs";
import { analyzeSentryTagBanlist } from "./check-sentry-tag-banlist.mjs";
import { analyzeSyntheticSloEnv } from "./check-synthetic-slo-env.mjs";
import { analyzeTelemetryEventInventory } from "./check-telemetry-event-inventory.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-observability-redaction.json";
const ARTIFACT_REL = "artifacts/operational-observability-redaction.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");

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

function validateCommands(root, config, packageScripts, ci, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_observability_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_observability_missing_ci_command", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }
    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_observability_missing_objective_artifact", { objective: objective.id, path: rel }));
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
      issues.push(issue(`${issuePrefix}_missing_marker_file`, { path: markerFile.path }));
    } else {
      for (const marker of markerFile.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { path: markerFile.path, marker }));
        }
      }
    }
    markerRows.push({
      path: markerFile.path,
      markerCount: markerFile.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }
  return markerRows.sort((a, b) => a.path.localeCompare(b.path));
}

function collectStructuredLoggingCoverage(root, config, issues) {
  const rows = [];
  for (const surface of config.structuredLoggingSurfaces ?? []) {
    const text = read(root, surface.path);
    const missingMarkers = [];
    if (!text) {
      issues.push(issue("operational_observability_structured_log_surface_missing", { id: surface.id, path: surface.path }));
      missingMarkers.push(...(surface.markers ?? []));
    } else {
      for (const marker of surface.markers ?? []) {
        if (!text.includes(marker)) {
          missingMarkers.push(marker);
          issues.push(issue("operational_observability_structured_log_marker_missing", {
            id: surface.id,
            path: surface.path,
            marker,
          }));
        }
      }
    }
    if (!Array.isArray(surface.requiredFields) || surface.requiredFields.length === 0) {
      issues.push(issue("operational_observability_structured_log_fields_missing", { id: surface.id }));
    }
    rows.push({
      id: surface.id,
      path: surface.path,
      requiredFields: [...(surface.requiredFields ?? [])].sort((a, b) => a.localeCompare(b)),
      requiredFieldCount: surface.requiredFields?.length ?? 0,
      markerCount: surface.markers?.length ?? 0,
      missingMarkerCount: missingMarkers.length,
      ok: missingMarkers.length === 0,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function collectRedactionSurfaceCoverage(config, packageScripts, ci, issues) {
  const rows = [];
  const seen = new Set();
  for (const row of config.redactionSurfaces ?? []) {
    if (seen.has(row.id)) {
      issues.push(issue("operational_observability_duplicate_redaction_surface", { id: row.id }));
    }
    seen.add(row.id);
    const packageScriptPresent = Boolean(packageScripts[row.command]);
    const ciPresent = ci.includes(commandText(row.command));
    if (!packageScriptPresent) {
      issues.push(issue("operational_observability_redaction_surface_missing_package_script", { id: row.id, script: row.command }));
    }
    if (row.ciRequired && !ciPresent) {
      issues.push(issue("operational_observability_redaction_surface_missing_ci", { id: row.id, script: row.command }));
    }
    rows.push({
      id: row.id,
      script: row.command,
      ciRequired: Boolean(row.ciRequired),
      packageScriptPresent,
      ciPresent,
      ok: packageScriptPresent && (!row.ciRequired || ciPresent),
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function collectArtifactOrdering(ci, issues) {
  const firstUploadIndex = ci.indexOf("actions/upload-artifact@");
  const ciArtifactCheckIndex = ci.indexOf(commandText("check:ci-artifact-secret-leakage"));
  const generatedArtifactCheckIndex = ci.indexOf(commandText("check:generated-artifact-hygiene"));
  const securityChecksumIndex = ci.indexOf(commandText("check:security-report-checksums"));
  if (firstUploadIndex >= 0 && (ciArtifactCheckIndex < 0 || ciArtifactCheckIndex > firstUploadIndex)) {
    issues.push(issue("operational_observability_artifact_redaction_check_after_upload"));
  }
  if (generatedArtifactCheckIndex < 0) {
    issues.push(issue("operational_observability_missing_generated_artifact_hygiene_ci"));
  }
  if (securityChecksumIndex < 0) {
    issues.push(issue("operational_observability_missing_security_report_checksum_ci"));
  }
  return {
    ciArtifactSecretLeakageBeforeFirstUpload:
      firstUploadIndex < 0 ? null : ciArtifactCheckIndex >= 0 && ciArtifactCheckIndex < firstUploadIndex,
    generatedArtifactHygieneCiPresent: generatedArtifactCheckIndex >= 0,
    securityReportChecksumCiPresent: securityChecksumIndex >= 0,
  };
}

function collectSentryReadiness(root, config, issues) {
  const contracts = validateMarkerRows(root, config.sentryContracts ?? [], "operational_observability_sentry", issues);
  return {
    contractCount: contracts.length,
    releaseMetadataCovered: contracts.some((row) => row.path === "src/lib/observability/sentry-release.test.ts" && row.ok),
    sourceMapUploadSettingsCovered: contracts.some((row) => row.path === "next.config.ts" && row.ok),
    disabledStateCovered: contracts.some((row) => row.path === "src/lib/observability/sentry.test.ts" && row.ok),
    contracts,
  };
}

function collectExpectedMonitorReadiness(root, config, issues) {
  const rows = [];
  const seen = new Set();
  for (const monitor of config.expectedMonitors ?? []) {
    if (seen.has(monitor.id)) issues.push(issue("operational_observability_duplicate_monitor", { id: monitor.id }));
    seen.add(monitor.id);

    const coverageRows = [];
    for (const coverage of monitor.codeCoverage ?? []) {
      const text = read(root, coverage.path);
      const missing = [];
      if (!text) {
        missing.push(...(coverage.markers ?? []));
        issues.push(issue("operational_observability_monitor_marker_file_missing", { id: monitor.id, path: coverage.path }));
      } else {
        for (const marker of coverage.markers ?? []) {
          if (!text.includes(marker)) {
            missing.push(marker);
            issues.push(issue("operational_observability_monitor_marker_missing", {
              id: monitor.id,
              path: coverage.path,
              marker,
            }));
          }
        }
      }
      coverageRows.push({
        path: coverage.path,
        markerCount: coverage.markers?.length ?? 0,
        missingCount: missing.length,
        ok: missing.length === 0,
      });
    }

    const codeCovered = coverageRows.length > 0 && coverageRows.every((row) => row.ok);
    if (!monitor.diagnosticId || !String(monitor.diagnosticId).trim()) {
      issues.push(issue("operational_observability_monitor_missing_diagnostic_id", { id: monitor.id }));
    }
    if (!monitor.sloKey || !String(monitor.sloKey).trim()) {
      issues.push(issue("operational_observability_monitor_missing_slo_key", { id: monitor.id }));
    }
    if (monitor.providerVerified !== true && !monitor.manualBoundary) {
      issues.push(issue("operational_observability_monitor_manual_boundary_missing", { id: monitor.id }));
    }

    rows.push({
      id: monitor.id,
      ownerArea: monitor.ownerArea,
      diagnosticId: monitor.diagnosticId,
      sloKey: monitor.sloKey,
      codeCovered,
      providerVerified: monitor.providerVerified === true,
      manualBoundary: monitor.manualBoundary ?? null,
      coverageRows: coverageRows.sort((a, b) => a.path.localeCompare(b.path)),
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("ai-context-redaction", analyzeAiContextRedaction(root)),
    normalizeReport("ci-artifact-secret-leakage", analyzeCiArtifactSecretLeakage(root)),
    normalizeReport("logging-telemetry-redaction", analyzeLoggingTelemetryRedaction(root)),
    normalizeReport("notification-payload-scrub-contract", analyzeNotificationPayloadScrubContract(root)),
    normalizeReport("persistence-redaction", analyzePersistenceRedaction(root)),
    normalizeReport("report-redaction-contract", analyzeReportRedactionContract(root)),
    normalizeReport("security-report-checksums", analyzeSecurityReportChecksums(root)),
    normalizeReport("sentry-tag-banlist", analyzeSentryTagBanlist(root)),
    normalizeReport("synthetic-slo-env", analyzeSyntheticSloEnv({})),
    normalizeReport("telemetry-event-inventory", analyzeTelemetryEventInventory({ root })),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_observability_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalObservabilityRedactionReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-observability-redaction") {
    issues.push(issue("operational_observability_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const structuredLogging = collectStructuredLoggingCoverage(root, config, issues);
  const redactionSurfaces = collectRedactionSurfaceCoverage(config, packageScripts, ci, issues);
  const artifactOrdering = collectArtifactOrdering(ci, issues);
  const sentryReadiness = collectSentryReadiness(root, config, issues);
  const testMarkers = validateMarkerRows(root, config.testMarkers ?? [], "operational_observability_test", issues);
  const expectedMonitors = collectExpectedMonitorReadiness(root, config, issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-observability-redaction",
    generatedBy: "scripts/check-operational-observability-redaction.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    structuredLoggingSurfaceCount: structuredLogging.length,
    redactionSurfaceCount: redactionSurfaces.length,
    sentryContractCount: sentryReadiness.contractCount,
    expectedMonitorCount: expectedMonitors.length,
    codeCoveredMonitorCount: expectedMonitors.filter((row) => row.codeCovered).length,
    providerVerifiedMonitorCount: expectedMonitors.filter((row) => row.providerVerified).length,
    manualBoundaryMonitorCount: expectedMonitors.filter((row) => row.manualBoundary).length,
    delegatedCheckCount: checks.length,
    commands,
    structuredLogging,
    redactionSurfaces,
    artifactOrdering,
    sentryReadiness,
    testMarkers,
    expectedMonitors,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalObservabilityRedaction(root = ROOT) {
  const report = buildOperationalObservabilityRedactionReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_observability_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_observability_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-observability-redaction",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function runOperationalObservabilityRedaction(root = ROOT) {
  const report = buildOperationalObservabilityRedactionReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }

  const checked = analyzeOperationalObservabilityRedaction(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalObservabilityRedaction();
}
