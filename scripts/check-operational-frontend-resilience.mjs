#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeE2eGeneratedDrift } from "./check-e2e-generated-drift.mjs";
import { analyzeRouteStateCoverage } from "./check-route-state-coverage.mjs";
import { analyzeUiSurfaceConsistency } from "./check-ui-surface-consistency.mjs";
import { collectEffectiveRouteStateKinds } from "./lib/route-state-utils.mjs";
import { routeStateManifest } from "../src/lib/qa/route-state-manifest.source.mjs";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-frontend-resilience.json";
const ARTIFACT_REL = "artifacts/operational-frontend-resilience.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");

const REQUIRED_STATE_SCENARIOS = new Set([
  "loading",
  "empty",
  "error",
  "offline",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "stale_data",
  "provider_outage",
]);

const REQUIRED_WORKFLOWS = new Set([
  "sign-in",
  "onboarding",
  "contract-upload",
  "field-review",
  "owner-assignment",
  "renewal-checkpoints",
  "obligations",
  "reports",
  "settings",
  "billing",
  "evidence",
  "search",
  "logout",
]);

const REQUIRED_ACCESSIBILITY = new Set([
  "axe-route-states",
  "keyboard",
  "focus-restoration",
  "landmarks",
  "accessible-names",
  "reduced-motion",
  "timeout-hints",
  "skip-links",
  "dialogs",
  "forms",
  "tables",
  "uploads",
]);

const REQUIRED_RESPONSIVE = new Set([
  "mobile",
  "tablet",
  "desktop",
  "long-text",
  "zoom",
  "dark-mode",
  "reduced-motion",
  "rtl",
  "pseudo-locale",
  "authenticated-shell",
  "horizontal-scroll",
]);

const REQUIRED_RECOVERY = new Set([
  "retry-button",
  "refetch-on-focus",
  "optimistic-rollback",
  "duplicate-submit-prevention",
  "recoverable-copy",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  if (!rel) return "";
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

function validateCommands(root, config, packageScripts, ci, pipelineText, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      const qaPipelinePresent = pipelineText.includes(`"${script}"`) || pipelineText.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_frontend_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_frontend_missing_ci_command", { objective: objective.id, script }));
      }
      if (row.qaPipelineRequired && !qaPipelinePresent) {
        issues.push(issue("operational_frontend_missing_qa_pipeline_step", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        qaPipelineRequired: Boolean(row.qaPipelineRequired),
        qaPipelinePresent: row.qaPipelineRequired ? qaPipelinePresent : null,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }
    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_frontend_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }
  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function validateMarkerRows(root, rows, requiredIds, issuePrefix, issues) {
  const seen = new Set();
  const out = [];
  for (const row of rows ?? []) {
    const text = read(root, row.path);
    const missing = [];
    if (seen.has(row.id)) {
      issues.push(issue(`${issuePrefix}_duplicate_id`, { id: row.id }));
    }
    seen.add(row.id);
    if (!text) {
      missing.push(...(row.markers ?? []));
      issues.push(issue(`${issuePrefix}_missing_file`, { id: row.id, path: row.path }));
    } else {
      for (const marker of row.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { id: row.id, path: row.path, marker }));
        }
      }
    }
    out.push({
      id: row.id,
      path: row.path,
      markerCount: row.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }

  for (const id of requiredIds) {
    if (!seen.has(id)) {
      issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function summarizeRouteFamilies(issues) {
  const rows = [];
  const families = [...new Set(uiSurfaceManifest.map((entry) => entry.routeFamily))].sort((a, b) => a.localeCompare(b));
  for (const family of families) {
    const entries = uiSurfaceManifest.filter((entry) => entry.routeFamily === family);
    const smokeRoutes = entries.filter((entry) => entry.coverage.includes("smoke"));
    const a11yRoutes = entries.filter((entry) => entry.coverage.includes("a11y"));
    const visualRoutes = entries.filter((entry) => entry.coverage.includes("visual"));
    const routeStateRoutes = entries.filter((entry) => {
      const kinds = collectEffectiveRouteStateKinds(entry.route, entry.shellFamily, routeStateManifest, false);
      return kinds.size > 0;
    });
    if (smokeRoutes.length > 0 && routeStateRoutes.length === 0) {
      issues.push(issue("operational_frontend_route_family_missing_route_state_coverage", { family }));
    }
    rows.push({
      family,
      routeCount: entries.length,
      smokeRouteCount: smokeRoutes.length,
      a11yRouteCount: a11yRoutes.length,
      visualRouteCount: visualRoutes.length,
      routeStateRouteCount: routeStateRoutes.length,
      ok: smokeRoutes.length === 0 || routeStateRoutes.length > 0,
    });
  }
  return rows;
}

function summarizeStateFiles(root, issues) {
  const rows = routeStateManifest
    .map((entry) => {
      const exists = fs.existsSync(path.join(root, entry.sourcePath));
      if (!exists) {
        issues.push(issue("operational_frontend_route_state_source_missing", {
          route: entry.route,
          kind: entry.kind,
          sourcePath: entry.sourcePath,
        }));
      }
      return {
        route: entry.route,
        kind: entry.kind,
        shellFamily: entry.shellFamily,
        sourcePath: entry.sourcePath,
        exists,
      };
    })
    .sort((a, b) => `${a.route}:${a.kind}:${a.sourcePath}`.localeCompare(`${b.route}:${b.kind}:${b.sourcePath}`));
  return rows;
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("e2e-generated-drift", analyzeE2eGeneratedDrift(root)),
    normalizeReport("route-state-coverage", analyzeRouteStateCoverage(root)),
    normalizeReport("ui-surface-consistency", analyzeUiSurfaceConsistency(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_frontend_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalFrontendResilienceReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const pipelineText = [
    read(root, "scripts/pipelines/pipeline-qa-code-maximal.mjs"),
    read(root, "scripts/pipelines/pipeline-verify.mjs"),
    read(root, "scripts/pipelines/pipeline-ci-build-e2e-local.mjs"),
    read(root, ".github/workflows/qa-max-nightly.yml"),
  ].join("\n");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-frontend-resilience") {
    issues.push(issue("operational_frontend_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, pipelineText, issues);
  const routeStateScenarios = validateMarkerRows(
    root,
    config.routeStateScenarios,
    REQUIRED_STATE_SCENARIOS,
    "operational_frontend_state_scenario",
    issues
  );
  const workflowScenarios = validateMarkerRows(
    root,
    config.workflowScenarios,
    REQUIRED_WORKFLOWS,
    "operational_frontend_workflow",
    issues
  );
  const accessibilityContracts = validateMarkerRows(
    root,
    config.accessibilityContracts,
    REQUIRED_ACCESSIBILITY,
    "operational_frontend_accessibility",
    issues
  );
  const responsiveVisualContracts = validateMarkerRows(
    root,
    config.responsiveVisualContracts,
    REQUIRED_RESPONSIVE,
    "operational_frontend_responsive",
    issues
  );
  const recoveryContracts = validateMarkerRows(
    root,
    config.recoveryContracts,
    REQUIRED_RECOVERY,
    "operational_frontend_recovery",
    issues
  );
  const routeFamilies = summarizeRouteFamilies(issues);
  const routeStates = summarizeStateFiles(root, issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-frontend-resilience",
    generatedBy: "scripts/check-operational-frontend-resilience.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    routeFamilyCount: routeFamilies.length,
    routeStateCount: routeStates.length,
    routeStateScenarioCount: routeStateScenarios.length,
    workflowScenarioCount: workflowScenarios.length,
    accessibilityContractCount: accessibilityContracts.length,
    responsiveVisualContractCount: responsiveVisualContracts.length,
    recoveryContractCount: recoveryContracts.length,
    delegatedCheckCount: checks.length,
    commands,
    routeFamilies,
    routeStates,
    routeStateScenarios,
    workflowScenarios,
    accessibilityContracts,
    responsiveVisualContracts,
    recoveryContracts,
    checks,
    manualBoundary: config.manualBoundary,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalFrontendResilience(root = ROOT) {
  const report = buildOperationalFrontendResilienceReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_frontend_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_frontend_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-frontend-resilience",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (WRITE) {
    const report = buildOperationalFrontendResilienceReport();
    fs.mkdirSync(path.dirname(path.join(ROOT, ARTIFACT_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ARTIFACT_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const report = analyzeOperationalFrontendResilience();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
