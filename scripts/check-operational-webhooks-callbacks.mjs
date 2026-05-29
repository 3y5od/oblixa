#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeAuthCallbackGuardrails } from "./check-auth-callback-guardrails.mjs";
import { analyzeCallbackDestinationIntegrity } from "./check-callback-destination-integrity.mjs";
import { analyzeCallbackDomainStrictness } from "./check-callback-domain-strictness.mjs";
import { analyzeDuplicateExecutionPolicy } from "./check-duplicate-execution-policy.mjs";
import { analyzeInboundIdentityBoundaries } from "./check-inbound-identity-boundaries.mjs";
import { analyzeOAuthPkceEnforcement } from "./check-oauth-pkce-enforcement.mjs";
import { analyzeOAuthStateIntegrity } from "./check-oauth-state-integrity.mjs";
import { analyzeOriginReferrerEnforcement } from "./check-origin-referrer-enforcement.mjs";
import { analyzeWebhookInboundPolicy } from "./check-webhook-inbound-policy.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-webhooks-callbacks.json";
const ARTIFACT_REL = "artifacts/operational-webhooks-callbacks.json";
const FIXTURE_REL = "src/lib/security/webhook-callback-fixtures.ts";
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

function parseMethods(source) {
  return [
    ...source.matchAll(/export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/gu),
  ]
    .map((match) => match[1])
    .sort((a, b) => a.localeCompare(b));
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function validateCommands(root, config, packageScripts, ci, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_webhooks_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_webhooks_missing_ci_command", { objective: objective.id, script }));
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
        issues.push(issue("operational_webhooks_missing_objective_artifact", { objective: objective.id, path: rel }));
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
      issues.push(issue("operational_webhooks_missing_marker_file", { path: markerFile.path }));
      missing.push(...(markerFile.markers ?? []));
    } else {
      for (const marker of collectMissingMarkers(text, markerFile.markers ?? [])) {
        missing.push(marker);
        issues.push(issue("operational_webhooks_missing_marker", { path: markerFile.path, marker }));
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

function validateRoutes(root, config, issues) {
  const registry = [];
  const seen = new Set();
  for (const row of config.routes ?? []) {
    if (seen.has(row.path)) issues.push(issue("operational_webhooks_duplicate_route", { path: row.path }));
    seen.add(row.path);

    const routeSource = read(root, row.routeFile);
    const testSource = read(root, row.testFile);
    const methods = routeSource ? parseMethods(routeSource) : [];
    const missingMethods = (row.methods ?? []).filter((method) => !methods.includes(method));

    if (!routeSource) issues.push(issue("operational_webhooks_missing_route_file", { id: row.id, routeFile: row.routeFile }));
    if (!testSource) issues.push(issue("operational_webhooks_missing_route_test", { id: row.id, testFile: row.testFile }));
    for (const method of missingMethods) {
      issues.push(issue("operational_webhooks_missing_method_export", { id: row.id, routeFile: row.routeFile, method }));
    }
    if (!row.idempotencyPolicy) {
      issues.push(issue("operational_webhooks_missing_idempotency_policy", { id: row.id }));
    }

    registry.push({
      id: row.id,
      path: row.path,
      routeFile: row.routeFile,
      testFile: row.testFile,
      expectedMethods: [...(row.methods ?? [])].sort((a, b) => a.localeCompare(b)),
      methods,
      provider: row.provider,
      direction: row.direction,
      idempotencyPolicy: row.idempotencyPolicy,
      hasRouteFile: Boolean(routeSource),
      hasTestFile: Boolean(testSource),
      ok: Boolean(routeSource) && Boolean(testSource) && missingMethods.length === 0,
    });
  }
  return registry.sort((a, b) => a.path.localeCompare(b.path));
}

function hasFixtureKind(source, family, kind) {
  const re = new RegExp(`family:\\s*"${family}"[\\s\\S]{0,600}?kind:\\s*"${kind}"`, "u");
  return re.test(source);
}

function validateFixtureCoverage(root, config, issues) {
  const source = read(root, FIXTURE_REL);
  if (!source) issues.push(issue("operational_webhooks_fixture_corpus_missing", { path: FIXTURE_REL }));
  const rows = [];
  for (const requirement of config.fixtureRequirements ?? []) {
    const presentKinds = [];
    const missingKinds = [];
    for (const kind of requirement.requiredKinds ?? []) {
      if (source && hasFixtureKind(source, requirement.family, kind)) {
        presentKinds.push(kind);
      } else {
        missingKinds.push(kind);
        issues.push(issue("operational_webhooks_missing_fixture_kind", { family: requirement.family, kind }));
      }
    }
    rows.push({
      family: requirement.family,
      requiredKinds: [...(requirement.requiredKinds ?? [])].sort((a, b) => a.localeCompare(b)),
      presentKinds: presentKinds.sort((a, b) => a.localeCompare(b)),
      missingKinds: missingKinds.sort((a, b) => a.localeCompare(b)),
      ok: missingKinds.length === 0,
    });
  }
  return rows.sort((a, b) => a.family.localeCompare(b.family));
}

function callbackExpectationRows(config) {
  return (config.callbackExpectations ?? [])
    .map((row) => ({
      provider: row.provider,
      expectedPath: row.expectedPath,
      optionalEnvKeys: [...(row.optionalEnvKeys ?? [])].sort((a, b) => a.localeCompare(b)),
      validationPolicy: "if optional env key is set, it must equal NEXT_PUBLIC_APP_URL plus expectedPath with no query or hash",
      manualBoundary: "live provider dashboard callback configuration is external",
    }))
    .sort((a, b) => `${a.provider}:${a.expectedPath}`.localeCompare(`${b.provider}:${b.expectedPath}`));
}

function delegatedReports(root, issues) {
  const rawReports = [
    analyzeWebhookInboundPolicy(root),
    analyzeDuplicateExecutionPolicy(root),
    analyzeInboundIdentityBoundaries(root),
    analyzeCallbackDestinationIntegrity(root),
    analyzeCallbackDomainStrictness(root),
    analyzeAuthCallbackGuardrails(root),
    analyzeOAuthStateIntegrity(root),
    analyzeOAuthPkceEnforcement(root),
    analyzeOriginReferrerEnforcement(root),
  ];
  const reports = rawReports
    .map((report) => ({
      checkId: report.checkId,
      ok: Boolean(report.ok),
      issueCount: report.issueCount ?? report.issues?.length ?? 0,
    }))
    .sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_webhooks_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function runtimeCallbackEnvIssues(config, env = process.env) {
  const issues = [];
  const appUrlValue = env.NEXT_PUBLIC_APP_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim() || "";
  const appUrl = appUrlValue ? parseUrl(appUrlValue) : null;

  for (const expectation of config.callbackExpectations ?? []) {
    const presentKeys = (expectation.optionalEnvKeys ?? []).filter((key) => Boolean(env[key]?.trim()));
    if (presentKeys.length === 0) continue;
    if (!appUrl) {
      issues.push(issue("operational_webhooks_callback_env_present_without_app_url", {
        provider: expectation.provider,
        envKeys: presentKeys.sort((a, b) => a.localeCompare(b)),
      }));
      continue;
    }
    for (const key of presentKeys) {
      const actual = parseUrl(env[key].trim());
      if (!actual) {
        issues.push(issue("operational_webhooks_callback_env_url_malformed", { provider: expectation.provider, key }));
        continue;
      }
      const expectedPath = expectation.expectedPath;
      if (
        actual.origin !== appUrl.origin ||
        actual.pathname !== expectedPath ||
        actual.search !== "" ||
        actual.hash !== ""
      ) {
        issues.push(issue("operational_webhooks_callback_url_mismatch", {
          provider: expectation.provider,
          key,
          expectedPath,
          actualPath: actual.pathname,
          originMatchesAppUrl: actual.origin === appUrl.origin,
          hasQuery: actual.search !== "",
          hasHash: actual.hash !== "",
        }));
      }
    }
  }
  return issues;
}

export function buildOperationalWebhooksCallbacksReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-webhooks-callbacks") {
    issues.push(issue("operational_webhooks_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const markerFiles = validateMarkers(root, config, issues);
  const registry = validateRoutes(root, config, issues);
  const fixtureCoverage = validateFixtureCoverage(root, config, issues);
  const callbackExpectations = callbackExpectationRows(config);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-webhooks-callbacks",
    generatedBy: "scripts/check-operational-webhooks-callbacks.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    routeCount: registry.length,
    commandCount: commands.length,
    markerFileCount: markerFiles.length,
    fixtureFamilyCount: fixtureCoverage.length,
    callbackExpectationCount: callbackExpectations.length,
    delegatedCheckCount: checks.length,
    commands,
    markerFiles,
    registry,
    fixtureCoverage,
    callbackExpectations,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalWebhooksCallbacks(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const report = buildOperationalWebhooksCallbacksReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_webhooks_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_webhooks_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-webhooks-callbacks",
    }));
  }
  issues.push(...runtimeCallbackEnvIssues(config));
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function runOperationalWebhooksCallbacks(root = ROOT) {
  const report = buildOperationalWebhooksCallbacksReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }
  const checked = analyzeOperationalWebhooksCallbacks(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalWebhooksCallbacks();
}
