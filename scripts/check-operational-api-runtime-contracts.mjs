#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

import { analyzeApiCorsPolicy } from "./check-api-cors-policy.mjs";
import { analyzeApiProblemJson } from "./check-api-problem-json.mjs";
import { analyzeApiRouteGuardNormalizationRatchet } from "./check-api-route-guard-normalization.mjs";
import { analyzeDecompressionBombGuards } from "./check-decompression-bomb-guards.mjs";
import { analyzeHttpMethodPolicy } from "./check-http-method-policy.mjs";
import { analyzeJsonBodyLimitedAdoption } from "./check-json-body-limited-adoption.mjs";
import { analyzeRequestFramingGuards } from "./check-request-framing-guards.mjs";
import { analyzeResponseSizeGuards } from "./check-response-size-guards.mjs";
import { findRouteUniverseFailures } from "./check-route-universe.mjs";
import { analyzeRuntimeHealthProbeContracts } from "./check-runtime-health-probe-contracts.mjs";
import { analyzeSensitiveCacheControls } from "./check-sensitive-cache-controls.mjs";
import { buildApiRuntimeSmokeRegistryPayload } from "./lib/build-api-runtime-smoke-registry.mjs";
import { buildRouteUniversePayload } from "./lib/build-route-universe.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-api-runtime-contracts.json";
const ARTIFACT_REL = "artifacts/operational-api-runtime-contracts.json";
const CI_REL = ".github/workflows/ci.yml";
const API_ROOT_REL = "src/app/api";
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
        issues.push(issue("operational_api_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_api_missing_ci_command", { objective: objective.id, script }));
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
        issues.push(issue("operational_api_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }
  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function validateMarkers(root, config, issues) {
  const rows = [];
  for (const markerFile of [...(config.sourceMarkers ?? []), ...(config.testMarkers ?? [])]) {
    const text = read(root, markerFile.path);
    const missing = [];
    if (!text) {
      missing.push(...(markerFile.markers ?? []));
      issues.push(issue("operational_api_missing_marker_file", { path: markerFile.path }));
    } else {
      for (const marker of markerFile.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue("operational_api_missing_marker", { path: markerFile.path, marker }));
        }
      }
    }
    rows.push({
      path: markerFile.path,
      markerCount: markerFile.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function loadRouteTestAllowlist(root) {
  const allowlistPath = path.join(root, "scripts", "api-route-test-allowlist.txt");
  const rows = new Set();
  if (!fs.existsSync(allowlistPath)) return rows;
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    rows.add(trimmed.replace(/\\/g, "/"));
  }
  return rows;
}

function apiRouteRelFromSourcePath(sourcePath) {
  return sourcePath.startsWith(`${API_ROOT_REL}/`) ? sourcePath.slice(`${API_ROOT_REL}/`.length) : null;
}

function routeToOpenApiPath(route) {
  return route.replace(/\[\[?\.\.\.([^\]]+)\]\]?|\[([^\]]+)\]/g, (_match, catchAll, single) => `{${catchAll ?? single}}`);
}

function routeTestEvidence(root, row, allowlist) {
  const apiRel = apiRouteRelFromSourcePath(row.sourcePath);
  if (!apiRel) {
    return { kind: "non_api_app_route", ok: true };
  }
  const testRel = path.join(path.dirname(row.sourcePath), "route.test.ts").replace(/\\/g, "/");
  if (fs.existsSync(path.join(root, testRel))) {
    return { kind: "colocated_test", ok: true, path: testRel };
  }
  if (allowlist.has(apiRel)) {
    return { kind: "allowlisted", ok: true, path: "scripts/api-route-test-allowlist.txt" };
  }
  return { kind: "missing", ok: false };
}

function loadOpenApi(root, issues) {
  const rel = "openapi.yaml";
  const text = read(root, rel);
  if (!text) {
    issues.push(issue("operational_api_missing_openapi_spec", { path: rel }));
    return {};
  }
  try {
    return YAML.parse(text)?.paths ?? {};
  } catch (error) {
    issues.push(issue("operational_api_invalid_openapi_spec", {
      path: rel,
      message: error instanceof Error ? error.message : String(error),
    }));
    return {};
  }
}

function collectApiRouteInventory(root, config, issues) {
  const universe = buildRouteUniversePayload(root).universe;
  const rows = universe.routes.filter((row) => row.kind === "api_route");
  const routeUniverse = findRouteUniverseFailures(root);
  for (const failure of routeUniverse.failures) {
    issues.push(issue("operational_api_route_universe_failure", { failure }));
  }

  const openapiPaths = loadOpenApi(root, issues);
  const routeTestAllowlist = loadRouteTestAllowlist(root);
  const requiredFields = config.inventoryRequiredFields ?? [];
  const inventoryRows = [];
  let openApiMethodCount = 0;
  let missingOpenApiMethodCount = 0;
  let colocatedTestCount = 0;
  let allowlistedTestCount = 0;

  for (const row of rows) {
    for (const field of requiredFields) {
      const value = row[field];
      const missing =
        value == null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
      if (missing) {
        issues.push(issue("operational_api_inventory_missing_field", {
          route: row.route,
          sourcePath: row.sourcePath,
          field,
        }));
      }
    }

    const testEvidence = routeTestEvidence(root, row, routeTestAllowlist);
    if (!testEvidence.ok) {
      issues.push(issue("operational_api_route_missing_test_evidence", {
        route: row.route,
        sourcePath: row.sourcePath,
      }));
    } else if (testEvidence.kind === "colocated_test") {
      colocatedTestCount += 1;
    } else if (testEvidence.kind === "allowlisted") {
      allowlistedTestCount += 1;
    }

    const openApiPath = row.route.startsWith("/api/") ? routeToOpenApiPath(row.route) : null;
    const specPath = openApiPath ? openapiPaths[openApiPath] : null;
    const methods = Array.isArray(row.methods) ? row.methods : [];
    const openApiMethods = [];
    if (openApiPath) {
      for (const method of methods) {
        const lower = method.toLowerCase();
        const operation = specPath?.[lower];
        if (operation?.responses && typeof operation.responses === "object") {
          openApiMethods.push(method);
          openApiMethodCount += 1;
        } else {
          missingOpenApiMethodCount += 1;
          issues.push(issue("operational_api_missing_response_schema", {
            route: row.route,
            sourcePath: row.sourcePath,
            method,
            openApiPath,
          }));
        }
      }
    }

    inventoryRows.push({
      route: row.route,
      sourcePath: row.sourcePath,
      methods,
      authModel: row.authModel,
      runtime: row.runtime,
      cachePolicy: row.cachePolicy,
      rateLimitPolicy: row.rateLimitPolicy,
      requestSchemaEvidence: row.bodyPolicy,
      responseSchemaEvidence: openApiPath
        ? { openApiPath, methods: openApiMethods, missingMethodCount: methods.length - openApiMethods.length }
        : { openApiPath: null, methods: [], missingMethodCount: 0 },
      owner: row.owner,
      expectedStatuses: row.expectedStatuses,
      testEvidence,
      smokeTier: row.smokeTier,
    });
  }

  return {
    routeUniverseFailureCount: routeUniverse.failures.length,
    apiRouteCount: rows.length,
    colocatedTestCount,
    allowlistedTestCount,
    openApiMethodCount,
    missingOpenApiMethodCount,
    rows: inventoryRows.sort((a, b) => `${a.route}:${a.sourcePath}`.localeCompare(`${b.route}:${b.sourcePath}`)),
  };
}

function collectProblemStatusRegistry(root, config, issues) {
  const source = read(root, "src/lib/http/problem.ts");
  const match = /SUPPORT_SAFE_PROBLEM_STATUSES\s*=\s*\[([^\]]+)\]/.exec(source);
  const statuses = match ? [...match[1].matchAll(/\b\d{3}\b/g)].map((entry) => Number(entry[0])) : [];
  const supported = new Set(statuses);
  for (const status of config.requiredProblemStatuses ?? []) {
    if (!supported.has(status)) {
      issues.push(issue("operational_api_missing_problem_status", { status }));
    }
  }
  return {
    required: [...(config.requiredProblemStatuses ?? [])],
    supported,
    supportedStatuses: statuses,
  };
}

function collectRuntimeSmokeRegistry(root, config, issues) {
  const artifactRel = "artifacts/assurance/api-runtime-smoke-registry.json";
  const artifactText = read(root, artifactRel);
  const fresh = buildApiRuntimeSmokeRegistryPayload(root);
  let artifact = null;
  if (!artifactText) {
    issues.push(issue("operational_api_runtime_smoke_artifact_missing", { path: artifactRel }));
  } else {
    artifact = JSON.parse(artifactText);
    const normalize = (routes) => JSON.stringify(
      [...(routes ?? [])].map((row) => ({
        routeFile: row.routeFile,
        pathTemplate: row.pathTemplate,
        samplePath: row.samplePath,
        methods: row.methods,
        runnerHint: row.runnerHint,
        verificationHint: row.verificationHint,
        expectedOutcomes: row.expectedOutcomes,
        smokeTier: row.smokeTier,
      })).sort((a, b) => a.pathTemplate.localeCompare(b.pathTemplate)),
      null,
      2
    );
    if (artifact.routeCount !== fresh.routeCount || normalize(artifact.routes) !== normalize(fresh.routes)) {
      issues.push(issue("operational_api_runtime_smoke_registry_drift", {
        path: artifactRel,
        writeCommand: "npm run generate:api-runtime-smoke-registry",
      }));
    }
  }

  const routes = artifact?.routes ?? fresh.routes ?? [];
  const runnerHints = new Set(routes.map((row) => row.runnerHint));
  for (const hint of config.requiredSmokeCategories ?? []) {
    if (!runnerHints.has(hint)) {
      issues.push(issue("operational_api_missing_runtime_smoke_category", { runnerHint: hint }));
    }
  }

  return {
    routeCount: routes.length,
    runnerHints: [...runnerHints].sort((a, b) => a.localeCompare(b)),
    ciCount: routes.filter((row) => row.smokeTier === "ci").length,
    nightlyCount: routes.filter((row) => row.smokeTier === "nightly").length,
    deferredCronCount: routes.filter((row) => row.runnerHint === "defer_cron_canary").length,
  };
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("api-cors-policy", analyzeApiCorsPolicy(root)),
    normalizeReport("api-problem-json", analyzeApiProblemJson(root)),
    normalizeReport("api-route-guard-normalization", analyzeApiRouteGuardNormalizationRatchet(root)),
    normalizeReport("decompression-bomb-guards", analyzeDecompressionBombGuards(root)),
    normalizeReport("http-method-policy", analyzeHttpMethodPolicy(root)),
    normalizeReport("json-body-limited-adoption", analyzeJsonBodyLimitedAdoption(root)),
    normalizeReport("request-framing-guards", analyzeRequestFramingGuards(root)),
    normalizeReport("response-size-guards", analyzeResponseSizeGuards(root)),
    normalizeReport("runtime-health-probe-contracts", analyzeRuntimeHealthProbeContracts({ root })),
    normalizeReport("sensitive-cache-controls", analyzeSensitiveCacheControls(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_api_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalApiRuntimeContractsReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-api-runtime-contracts") {
    issues.push(issue("operational_api_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const markerFiles = validateMarkers(root, config, issues);
  const apiInventory = collectApiRouteInventory(root, config, issues);
  const problemStatuses = collectProblemStatusRegistry(root, config, issues);
  const runtimeSmoke = collectRuntimeSmokeRegistry(root, config, issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-api-runtime-contracts",
    generatedBy: "scripts/check-operational-api-runtime-contracts.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    markerFileCount: markerFiles.length,
    apiRouteCount: apiInventory.apiRouteCount,
    openApiMethodCount: apiInventory.openApiMethodCount,
    missingOpenApiMethodCount: apiInventory.missingOpenApiMethodCount,
    routeUniverseFailureCount: apiInventory.routeUniverseFailureCount,
    runtimeSmokeRouteCount: runtimeSmoke.routeCount,
    runtimeSmokeCiCount: runtimeSmoke.ciCount,
    runtimeSmokeNightlyCount: runtimeSmoke.nightlyCount,
    delegatedCheckCount: checks.length,
    commands,
    markerFiles,
    apiInventory,
    problemStatuses: {
      required: problemStatuses.required,
      supportedStatuses: problemStatuses.supportedStatuses,
    },
    runtimeSmoke,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalApiRuntimeContracts(root = ROOT) {
  const report = buildOperationalApiRuntimeContractsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_api_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_api_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-api-runtime-contracts",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function runOperationalApiRuntimeContracts(root = ROOT) {
  const report = buildOperationalApiRuntimeContractsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }

  const checked = analyzeOperationalApiRuntimeContracts(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalApiRuntimeContracts();
}
