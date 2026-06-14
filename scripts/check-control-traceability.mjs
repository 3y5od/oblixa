#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ARTIFACT_REL,
  CONFIG_REL,
  STRIDE_ARTIFACT_REL,
  analyzeFrameworkControlMap,
  analyzeMinimums,
  analyzeResidualRisks,
  analyzeSecurityControlRows,
  analyzeThreatRows,
  buildAttackSurfaceInventory,
  buildStrideDreadThreatModelArtifact,
  classifyAttackSurface,
  issue,
  mapStrideThreats,
  packageScripts,
  read,
  readJson,
  stableStringify,
  validateConfiguredCommands,
  writeJson,
} from "./lib/control-traceability-helpers.mjs";

export { buildStrideDreadThreatModelArtifact, classifyAttackSurface, mapStrideThreats };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
export function buildOperationalThreatModelControlTraceabilityReport(root = DEFAULT_ROOT, options = {}) {
  const checkDrift = Boolean(options.checkDrift);
  const issues = [];
  const config = readJson(root, CONFIG_REL, {});
  const scripts = packageScripts(root);
  const commandRows = validateConfiguredCommands(root, config, scripts, issues);
  const routeUniverse = readJson(root, "artifacts/route-universe.json", { routes: [] });
  const routeRows = Array.isArray(routeUniverse.routes) ? routeUniverse.routes : [];
  const securityRouteRows = readJson(root, "artifacts/security-route-matrix.json", []);
  const securityControlRows = readJson(root, "artifacts/security-control-coverage-matrix.rows.json", { rows: [] })?.rows ?? [];
  const gdprSoc2Controls = readJson(root, "artifacts/gdpr-soc2-control-map.json", { controls: [] })?.controls ?? [];
  const threatRows = readJson(root, "artifacts/assurance/threat-rows.json", { rows: [] })?.rows ?? [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-threat-model-control-traceability") {
    issues.push(issue("invalid_control_traceability_config_metadata"));
  }

  const securityControlCoverage = analyzeSecurityControlRows(root, config, securityControlRows, issues);
  const frameworkControlCoverage = analyzeFrameworkControlMap(root, gdprSoc2Controls, issues);
  const threatRowCoverage = analyzeThreatRows(root, scripts, threatRows, issues);
  const attackSurfaceInventory = buildAttackSurfaceInventory(root, config, scripts, routeRows, securityRouteRows, issues);
  const minimumChecks = analyzeMinimums(config, attackSurfaceInventory, securityControlCoverage, threatRowCoverage, issues);
  const residualRiskReport = analyzeResidualRisks(root, config, scripts, threatRows, issues);

  const report = {
    ok: false,
    schemaVersion: 1,
    source: "code-owned-operational-threat-model-control-traceability",
    generatedBy: "scripts/check-control-traceability.mjs --write",
    generatedFrom: CONFIG_REL,
    sourceArtifacts: [
      "artifacts/route-universe.json",
      "artifacts/security-route-matrix.json",
      "artifacts/security-control-coverage-matrix.rows.json",
      "artifacts/gdpr-soc2-control-map.json",
      "artifacts/assurance/threat-rows.json",
      "config/qa-external-waiver-registry.json",
      "config/operational-manual-boundaries.json",
    ],
    commandRows,
    minimumChecks,
    securityControlCoverage,
    frameworkControlCoverage,
    threatRowCoverage,
    attackSurfaceInventory,
    residualRiskReport,
    issueCount: 0,
    issues: [],
  };
  report.ok = issues.length === 0;
  report.issueCount = issues.length;
  report.issues = issues;

  const strideDreadThreatModel = buildStrideDreadThreatModelArtifact(report);

  if (checkDrift) {
    const expectedReport = stableStringify(report);
    const actualReport = read(root, ARTIFACT_REL);
    if (!actualReport) {
      issues.push(issue("control_traceability_artifact_missing", { path: ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    } else if (actualReport !== expectedReport) {
      issues.push(issue("control_traceability_artifact_drift", { path: ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    }

    const expectedStride = stableStringify(strideDreadThreatModel);
    const actualStride = read(root, STRIDE_ARTIFACT_REL);
    if (!actualStride) {
      issues.push(issue("stride_dread_threat_model_artifact_missing", { path: STRIDE_ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    } else if (actualStride !== expectedStride) {
      issues.push(issue("stride_dread_threat_model_artifact_drift", { path: STRIDE_ARTIFACT_REL, writeCommand: "npm run write:control-traceability" }));
    }

    report.ok = issues.length === 0;
    report.issueCount = issues.length;
    report.issues = issues;
  }

  return { report, strideDreadThreatModel };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, strict: false, write: false, verbose: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    }
  }
  return options;
}

function summarizeReport(report) {
  return {
    ok: report.ok,
    schemaVersion: report.schemaVersion,
    source: report.source,
    generatedFrom: report.generatedFrom,
    attackSurfaceRows: report.attackSurfaceInventory.rowCount,
    highRiskSurfaceRows: report.attackSurfaceInventory.highRiskSurfaceCount,
    securityControlRows: report.securityControlCoverage.rowCount,
    threatRows: report.threatRowCoverage.rowCount,
    residualRiskRows: report.residualRiskReport.riskCount,
    strideCoverage: report.attackSurfaceInventory.strideCoverage,
    minimumChecks: report.minimumChecks,
    issueCount: report.issueCount,
    issues: report.issues.slice(0, 40),
  };
}

export function runControlTraceabilityCheck(options = parseArgs(process.argv.slice(2))) {
  const { report, strideDreadThreatModel } = buildOperationalThreatModelControlTraceabilityReport(options.root, {
    checkDrift: !options.write,
  });

  if (options.write) {
    writeJson(options.root, ARTIFACT_REL, report);
    writeJson(options.root, STRIDE_ARTIFACT_REL, strideDreadThreatModel);
  }

  console.log(JSON.stringify(options.verbose ? report : summarizeReport(report), null, 2));
  if (options.strict && !report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runControlTraceabilityCheck();
}
