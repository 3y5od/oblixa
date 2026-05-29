#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeApiProblemJson } from "./check-api-problem-json.mjs";
import { analyzeApiRouteRateLimitCoverage } from "./check-api-route-rate-limit-coverage.mjs";
import { analyzeCallbackDestinationIntegrity } from "./check-callback-destination-integrity.mjs";
import { analyzeConcurrencyCapGuards } from "./check-concurrency-cap-guards.mjs";
import { analyzeDecompressionBombGuards } from "./check-decompression-bomb-guards.mjs";
import { analyzeExportSecurityGuards } from "./check-export-security-guards.mjs";
import { analyzeJsonBodyLimitedAdoption } from "./check-json-body-limited-adoption.mjs";
import { analyzePaginationGuardrails } from "./check-pagination-guardrails.mjs";
import { analyzeParserRiskControls } from "./check-parser-risk-controls.mjs";
import { analyzeRateLimitDistributionSafety } from "./check-rate-limit-distribution-safety.mjs";
import { analyzeRateLimitKeyCardinality } from "./check-rate-limit-key-cardinality.mjs";
import { analyzeRegexDosRisk } from "./check-regex-dos-risk.mjs";
import { analyzeRequestFramingGuards } from "./check-request-framing-guards.mjs";
import { analyzeResponseSizeGuards } from "./check-response-size-guards.mjs";
import { analyzeTimeoutBudgetGuards } from "./check-timeout-budget-guards.mjs";
import { buildRouteUniversePayload } from "./lib/build-route-universe.mjs";
import { walkFiles } from "./lib/static-check-utils.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-rate-limits-abuse-bounds.json";
const ARTIFACT_REL = "artifacts/operational-rate-limits-abuse-bounds.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
    issueCount: Number(report.issueCount ?? report.issues?.length ?? report.errors?.length ?? report.violationCount ?? 0),
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
        issues.push(issue("operational_abuse_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_abuse_missing_ci_command", { objective: objective.id, script }));
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
        issues.push(issue("operational_abuse_missing_objective_artifact", { objective: objective.id, path: rel }));
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
      issues.push(issue("operational_abuse_missing_marker_file", { path: markerFile.path }));
    } else {
      for (const marker of markerFile.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue("operational_abuse_missing_marker", { path: markerFile.path, marker }));
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

function collectRateLimitCatalog(root, config, issues) {
  const rel = "src/lib/rate-limit.ts";
  const source = read(root, rel);
  const match = /export\s+const\s+RATE_LIMITS\s*=\s*\{([\s\S]*?)\n\}\s+as\s+const;/u.exec(source);
  const keys = match ? [...match[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((entry) => entry[1]) : [];
  const keySet = new Set(keys);
  for (const requiredKey of config.requiredRateLimitCatalogKeys ?? []) {
    if (!keySet.has(requiredKey)) {
      issues.push(issue("operational_abuse_missing_rate_limit_catalog_key", { key: requiredKey }));
    }
  }
  return {
    path: rel,
    keyCount: keys.length,
    requiredKeyCount: config.requiredRateLimitCatalogKeys?.length ?? 0,
    missingRequiredKeys: [...(config.requiredRateLimitCatalogKeys ?? [])].filter((key) => !keySet.has(key)),
    keys: keys.sort((a, b) => a.localeCompare(b)),
  };
}

function routeMatchesCategory(route, category) {
  return (category.routeIncludes ?? []).some((needle) => route.includes(needle));
}

function collectRouteLimitInventory(root, config, issues) {
  const routes = buildRouteUniversePayload(root).universe.routes.filter((row) => row.kind === "api_route");
  const acceptedPolicies = new Set((config.acceptedRateLimitPolicies ?? []).map((row) => row.policy));
  const documentedSessionMutation = config.documentedSessionMutationPolicy ?? {};
  const documentedMutationAuthModels = new Set(documentedSessionMutation.allowedAuthModels ?? []);
  const policyCounts = {};
  const authCountsForMutationRequired = {};
  const categoryCounts = {};
  let mutatingRouteCount = 0;
  let explicitOrSpecialMutatingRouteCount = 0;
  let documentedSessionMutationCount = 0;
  const mutationRows = [];

  for (const category of config.surfaceCategories ?? []) {
    categoryCounts[category.id] = 0;
  }

  for (const row of routes) {
    const policy = row.rateLimitPolicy ?? "missing";
    policyCounts[policy] = (policyCounts[policy] ?? 0) + 1;
    if (!acceptedPolicies.has(policy)) {
      issues.push(issue("operational_abuse_unknown_rate_limit_policy", {
        route: row.route,
        sourcePath: row.sourcePath,
        policy,
      }));
    }
    for (const category of config.surfaceCategories ?? []) {
      if (routeMatchesCategory(row.route, category)) categoryCounts[category.id] += 1;
    }

    const methods = Array.isArray(row.methods) ? row.methods : [];
    const mutating = methods.some((method) => MUTATING_METHODS.has(method));
    if (!mutating) continue;
    mutatingRouteCount += 1;

    if (["explicit", "cron", "webhook", "external_or_token"].includes(policy)) {
      explicitOrSpecialMutatingRouteCount += 1;
    } else if (policy === documentedSessionMutation.policy && documentedMutationAuthModels.has(row.authModel)) {
      documentedSessionMutationCount += 1;
      authCountsForMutationRequired[row.authModel] = (authCountsForMutationRequired[row.authModel] ?? 0) + 1;
    } else {
      issues.push(issue("operational_abuse_mutating_route_without_limit_or_reason", {
        route: row.route,
        sourcePath: row.sourcePath,
        methods,
        authModel: row.authModel,
        policy,
      }));
    }

    mutationRows.push({
      route: row.route,
      sourcePath: row.sourcePath,
      methods,
      authModel: row.authModel,
      rateLimitPolicy: policy,
      owner: row.owner,
    });
  }

  for (const category of config.surfaceCategories ?? []) {
    if (categoryCounts[category.id] === 0) {
      issues.push(issue("operational_abuse_empty_surface_category", { category: category.id }));
    }
  }

  return {
    apiRouteCount: routes.length,
    mutatingRouteCount,
    explicitOrSpecialMutatingRouteCount,
    documentedSessionMutationCount,
    policyCounts,
    authCountsForMutationRequired,
    categoryCounts,
    documentedSessionMutationPolicy: documentedSessionMutation,
    mutationRows: mutationRows.sort((a, b) => `${a.route}:${a.sourcePath}`.localeCompare(`${b.route}:${b.sourcePath}`)),
  };
}

function collectRateLimitBehaviorEvidence(root, config, issues) {
  const routeTestFiles = walkFiles(root, ["src/app/api"], {
    include(rel, name) {
      return name === "route.test.ts";
    },
  });
  const route429Tests = [];
  for (const file of routeTestFiles) {
    const source = read(root, file);
    if (/\b429\b/u.test(source) && /rate limit|rate-limited|rate limited|Retry-After/iu.test(source)) {
      route429Tests.push(file);
    }
  }
  const minRoute429Tests = Number(config.minRoute429Tests ?? 0);
  if (route429Tests.length < minRoute429Tests) {
    issues.push(issue("operational_abuse_insufficient_route_429_tests", {
      actual: route429Tests.length,
      expectedAtLeast: minRoute429Tests,
    }));
  }

  return {
    routeTestFileCount: routeTestFiles.length,
    route429TestCount: route429Tests.length,
    minRoute429Tests,
    route429Tests,
  };
}

function delegatedReports(root, issues) {
  const rawReports = [
    normalizeReport("api-problem-json", analyzeApiProblemJson(root)),
    normalizeReport("api-route-rate-limit-coverage", analyzeApiRouteRateLimitCoverage(root)),
    normalizeReport("callback-destination-integrity", analyzeCallbackDestinationIntegrity(root)),
    normalizeReport("concurrency-cap-guards", analyzeConcurrencyCapGuards(root)),
    normalizeReport("decompression-bomb-guards", analyzeDecompressionBombGuards(root)),
    normalizeReport("export-security-guards", analyzeExportSecurityGuards(root)),
    normalizeReport("json-body-limited-adoption", analyzeJsonBodyLimitedAdoption(root)),
    normalizeReport("pagination-guardrails", analyzePaginationGuardrails(root)),
    normalizeReport("parser-risk-controls", analyzeParserRiskControls(root)),
    normalizeReport("rate-limit-distribution-safety", analyzeRateLimitDistributionSafety(root)),
    normalizeReport("rate-limit-key-cardinality", analyzeRateLimitKeyCardinality(root)),
    normalizeReport("regex-dos-risk", analyzeRegexDosRisk(root)),
    normalizeReport("request-framing-guards", analyzeRequestFramingGuards(root)),
    normalizeReport("response-size-guards", analyzeResponseSizeGuards(root)),
    normalizeReport("timeout-budget-guards", analyzeTimeoutBudgetGuards(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of rawReports) {
    if (!report.ok) {
      issues.push(issue("operational_abuse_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return rawReports;
}

export function buildOperationalRateLimitsAbuseBoundsReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-rate-limits-abuse-bounds") {
    issues.push(issue("operational_abuse_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const markerFiles = validateMarkers(root, config, issues);
  const rateLimitCatalog = collectRateLimitCatalog(root, config, issues);
  const routeInventory = collectRouteLimitInventory(root, config, issues);
  const behaviorEvidence = collectRateLimitBehaviorEvidence(root, config, issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-rate-limits-abuse-bounds",
    generatedBy: "scripts/check-operational-rate-limits-abuse-bounds.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    markerFileCount: markerFiles.length,
    rateLimitCatalogKeyCount: rateLimitCatalog.keyCount,
    apiRouteCount: routeInventory.apiRouteCount,
    mutatingRouteCount: routeInventory.mutatingRouteCount,
    explicitOrSpecialMutatingRouteCount: routeInventory.explicitOrSpecialMutatingRouteCount,
    documentedSessionMutationCount: routeInventory.documentedSessionMutationCount,
    route429TestCount: behaviorEvidence.route429TestCount,
    delegatedCheckCount: checks.length,
    commands,
    markerFiles,
    rateLimitCatalog,
    routeInventory,
    behaviorEvidence,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalRateLimitsAbuseBounds(root = ROOT) {
  const report = buildOperationalRateLimitsAbuseBoundsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_abuse_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_abuse_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-rate-limits-abuse-bounds",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function runOperationalRateLimitsAbuseBounds(root = ROOT) {
  const report = buildOperationalRateLimitsAbuseBoundsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }

  const checked = analyzeOperationalRateLimitsAbuseBounds(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalRateLimitsAbuseBounds();
}
