#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-performance-load-chaos.json";
const ARTIFACT_REL = "artifacts/operational-performance-load-chaos.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");

const REQUIRED_LOAD_TARGETS = new Set([
  "landing",
  "login",
  "dashboard",
  "contracts-list",
  "contract-detail",
  "upload",
  "search",
  "reports",
  "exports",
  "cron-like",
  "provider-mocked",
]);

const REQUIRED_SOAK_STRESS = new Set([
  "k6-smoke-thresholds",
  "k6-soak-opt-in",
  "staging-smoke-target-guard",
  "k6-soak-thresholds",
]);

const REQUIRED_CHAOS_FIXTURES = new Set([
  "supabase-latency",
  "stripe-failure",
  "resend-failure",
  "openai-timeout",
  "upstash-outage",
  "webhook-duplicate",
  "cron-overlap",
  "db-conflict",
]);

const REQUIRED_CACHE_CASES = new Set([
  "stale-reads",
  "read-after-write-lag",
  "revalidation-tags",
  "cache-headers",
  "stale-mutation-guards",
  "cache-poisoning-inputs",
]);

const REQUIRED_BUDGETS = new Set([
  "js-bundle",
  "server-build-output",
  "route-runtime-class",
  "max-duration",
  "expensive-dependency-imports",
]);

const REQUIRED_ENV_GUARDS = new Set([
  "production-target-block",
  "explicit-production-opt-in",
  "load-cost-caps",
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

function validateCommands(root, config, packageScripts, ci, pipelineText, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      const qaPipelinePresent = pipelineText.includes(commandText(script)) || pipelineText.includes(`"${script}"`);
      if (!packageScriptPresent) {
        issues.push(issue("operational_performance_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_performance_missing_ci_command", { objective: objective.id, script }));
      }
      if (row.qaPipelineRequired && !qaPipelinePresent) {
        issues.push(issue("operational_performance_missing_qa_pipeline_step", { objective: objective.id, script }));
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
        issues.push(issue("operational_performance_missing_objective_artifact", { objective: objective.id, path: rel }));
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
    if (!seen.has(id)) issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function summarizeArtifactInputs(root, issues) {
  const rels = [
    "artifacts/route-performance-budgets.json",
    "artifacts/autonomous-perf-ci-runtime-budget.json",
    "artifacts/autonomous-perf-coverage-matrix.json",
    "config/autonomous-perf-phase-closure.json",
  ];
  return rels.map((rel) => {
    const exists = fs.existsSync(path.join(root, rel));
    if (!exists) issues.push(issue("operational_performance_missing_referenced_artifact", { path: rel }));
    return { path: rel, exists };
  });
}

function summarizeCodeContracts(root, issues) {
  const text = read(root, "src/lib/performance/operational-performance-contracts.ts");
  const validationMarkers = [
    "validateOperationalPerformanceContracts",
    "LOAD_SMOKE_TARGETS",
    "CHAOS_FIXTURES",
    "CACHE_CONSISTENCY_CASES",
    "BUNDLE_RUNTIME_BUDGETS",
    "isSafeLoadTarget",
  ];
  const missing = validationMarkers.filter((marker) => !text.includes(marker));
  for (const marker of missing) {
    issues.push(issue("operational_performance_missing_contract_marker", { marker }));
  }
  return {
    sourcePath: "src/lib/performance/operational-performance-contracts.ts",
    markerCount: validationMarkers.length,
    missingCount: missing.length,
    ok: missing.length === 0,
  };
}

export function buildOperationalPerformanceLoadChaosReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const pipelineText = [
    read(root, ".github/workflows/qa-max-nightly.yml"),
    read(root, ".github/workflows/qa-code-maximal.yml"),
    read(root, ".github/workflows/load-smoke-optional.yml"),
    read(root, "scripts/pipelines/pipeline-autonomous-perf.mjs"),
    read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs"),
  ].join("\n");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-performance-load-chaos") {
    issues.push(issue("operational_performance_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, pipelineText, issues);
  const loadSmokeTargets = validateMarkerRows(
    root,
    config.loadSmokeTargets,
    REQUIRED_LOAD_TARGETS,
    "operational_performance_load_target",
    issues
  );
  const soakStressScaffolding = validateMarkerRows(
    root,
    config.soakStressScaffolding,
    REQUIRED_SOAK_STRESS,
    "operational_performance_soak_stress",
    issues
  );
  const chaosFixtures = validateMarkerRows(
    root,
    config.chaosFixtures,
    REQUIRED_CHAOS_FIXTURES,
    "operational_performance_chaos_fixture",
    issues
  );
  const cacheConsistencyCases = validateMarkerRows(
    root,
    config.cacheConsistencyCases,
    REQUIRED_CACHE_CASES,
    "operational_performance_cache_case",
    issues
  );
  const budgetContracts = validateMarkerRows(
    root,
    config.budgetContracts,
    REQUIRED_BUDGETS,
    "operational_performance_budget",
    issues
  );
  const environmentGuards = validateMarkerRows(
    root,
    config.environmentGuards,
    REQUIRED_ENV_GUARDS,
    "operational_performance_environment_guard",
    issues
  );
  const artifactInputs = summarizeArtifactInputs(root, issues);
  const codeContracts = summarizeCodeContracts(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-performance-load-chaos",
    generatedBy: "scripts/check-operational-performance-load-chaos.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    loadSmokeTargetCount: loadSmokeTargets.length,
    soakStressScaffoldingCount: soakStressScaffolding.length,
    chaosFixtureCount: chaosFixtures.length,
    cacheConsistencyCaseCount: cacheConsistencyCases.length,
    budgetContractCount: budgetContracts.length,
    environmentGuardCount: environmentGuards.length,
    artifactInputCount: artifactInputs.length,
    commands,
    loadSmokeTargets,
    soakStressScaffolding,
    chaosFixtures,
    cacheConsistencyCases,
    budgetContracts,
    environmentGuards,
    artifactInputs,
    codeContracts,
    manualBoundary: config.manualBoundary,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalPerformanceLoadChaos(root = ROOT) {
  const report = buildOperationalPerformanceLoadChaosReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_performance_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_performance_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-performance-load-chaos",
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
    const report = buildOperationalPerformanceLoadChaosReport();
    fs.mkdirSync(path.dirname(path.join(ROOT, ARTIFACT_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ARTIFACT_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const report = analyzeOperationalPerformanceLoadChaos();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
