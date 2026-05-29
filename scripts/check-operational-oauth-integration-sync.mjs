#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeAuditEventCoverage } from "./check-audit-event-coverage.mjs";
import { analyzeOAuthPkceEnforcement } from "./check-oauth-pkce-enforcement.mjs";
import { analyzeOAuthStateIntegrity } from "./check-oauth-state-integrity.mjs";
import { analyzeProviderIntegrationFixtures } from "./check-provider-integration-fixtures.mjs";
import { analyzeSecurityEventContract } from "./check-security-event-contract.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-oauth-integration-sync.json";
const ARTIFACT_REL = "artifacts/operational-oauth-integration-sync.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_SYNC_JOBS = new Set([
  "calendar-sync",
  "crm-sync",
  "token-refresh",
  "oauth-start",
  "oauth-callback",
  "disconnect",
]);

const REQUIRED_OAUTH_NEGATIVE_PATHS = new Set([
  "missing-state",
  "wrong-state",
  "expired-state",
  "reused-state",
  "missing-code",
  "denied-consent",
  "wrong-redirect-uri",
  "provider-error",
  "callback-replay",
  "unsafe-state",
  "oversized-code",
  "unsupported-provider",
]);

const REQUIRED_TOKEN_REFRESH_OPERATIONS = new Set([
  "success",
  "expired-refresh-token",
  "revoked-token",
  "provider-timeout",
  "rotated-encryption-key",
  "malformed-response",
  "repeated-failure",
  "invalid-refresh-url",
  "missing-refresh-config",
  "scan-truncation",
]);

const REQUIRED_DISCONNECT_OPERATIONS = new Set([
  "revocation",
  "local-token-deletion",
  "stale-scheduled-jobs",
  "webhook-cleanup",
  "audit-events",
  "user-facing-disconnected-state",
  "historical-record-preservation",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  if (!rel) return "";
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function commandText(script) {
  return `npm run ${script}`;
}

function validationCommandExists(scripts, command) {
  if (typeof command !== "string" || !command.trim()) return false;
  if (scripts[command]) return true;
  if (command.startsWith("npm run ")) return Boolean(scripts[command.slice("npm run ".length)]);
  return false;
}

function validateCommands(root, config, scripts, issues) {
  const ci = read(root, ".github/workflows/ci.yml");
  const rows = [];

  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(scripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_oauth_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_oauth_missing_ci_command", { objective: objective.id, script }));
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
        issues.push(issue("operational_oauth_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }

  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

export function validateMarkerRows(root, rows, requiredIds, issuePrefix, issues, scripts = packageScripts(root)) {
  const seen = new Set();
  const out = [];

  for (const row of rows ?? []) {
    const text = read(root, row.path);
    const missing = [];
    if (seen.has(row.id)) issues.push(issue(`${issuePrefix}_duplicate_id`, { id: row.id }));
    seen.add(row.id);
    if (typeof row.owner !== "string" || !row.owner.startsWith("@")) {
      issues.push(issue(`${issuePrefix}_missing_owner`, { id: row.id, owner: row.owner ?? null }));
    }
    if (!validationCommandExists(scripts, row.validationCommand)) {
      issues.push(issue(`${issuePrefix}_missing_validation_command`, {
        id: row.id,
        validationCommand: row.validationCommand ?? null,
      }));
    }
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
      owner: row.owner ?? null,
      validationCommand: row.validationCommand ?? null,
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

function countConstStringArrayEntries(text, constName) {
  const start = text.indexOf(`export const ${constName} = [`);
  if (start < 0) return 0;
  const end = text.indexOf("] as const", start);
  if (end < 0) return 0;
  return [...text.slice(start, end).matchAll(/"([^"]+)"/g)].length;
}

function countObjectArrayIds(text, constName) {
  const start = text.indexOf(`export const ${constName}:`);
  if (start < 0) return 0;
  const end = text.indexOf("] as const", start);
  if (end < 0) return 0;
  return [...text.slice(start, end).matchAll(/\bid:\s*"([^"]+)"/g)].length;
}

function analyzeRuntimeInventory(root, issues) {
  const text = read(root, "src/lib/integrations/operational-sync.ts");
  const syncJobIdCount = countConstStringArrayEntries(text, "OPERATIONAL_INTEGRATION_SYNC_JOB_IDS");
  const oauthNegativePathCount = countConstStringArrayEntries(text, "OPERATIONAL_OAUTH_NEGATIVE_PATH_IDS");
  const tokenRefreshScenarioCount = countConstStringArrayEntries(text, "OPERATIONAL_TOKEN_REFRESH_SCENARIO_IDS");
  const disconnectScenarioCount = countConstStringArrayEntries(text, "OPERATIONAL_INTEGRATION_DISCONNECT_SCENARIO_IDS");
  const syncJobCount = countObjectArrayIds(text, "OPERATIONAL_INTEGRATION_SYNC_JOBS");

  if (syncJobIdCount < REQUIRED_SYNC_JOBS.size) issues.push(issue("operational_oauth_sync_job_inventory_too_small", { syncJobIdCount }));
  if (oauthNegativePathCount < REQUIRED_OAUTH_NEGATIVE_PATHS.size) issues.push(issue("operational_oauth_negative_path_inventory_too_small", { oauthNegativePathCount }));
  if (tokenRefreshScenarioCount < REQUIRED_TOKEN_REFRESH_OPERATIONS.size) issues.push(issue("operational_oauth_refresh_inventory_too_small", { tokenRefreshScenarioCount }));
  if (disconnectScenarioCount < REQUIRED_DISCONNECT_OPERATIONS.size) issues.push(issue("operational_oauth_disconnect_inventory_too_small", { disconnectScenarioCount }));
  if (syncJobCount < REQUIRED_SYNC_JOBS.size) issues.push(issue("operational_oauth_sync_job_registry_too_small", { syncJobCount }));

  return {
    syncJobIdCount,
    oauthNegativePathCount,
    tokenRefreshScenarioCount,
    disconnectScenarioCount,
    syncJobCount,
  };
}

function analyzeDelegatedChecks(root, issues) {
  const checks = [
    analyzeOAuthStateIntegrity(root),
    analyzeOAuthPkceEnforcement(root),
    analyzeProviderIntegrationFixtures(root),
    analyzeAuditEventCoverage(root),
    analyzeSecurityEventContract(root),
  ];

  for (const report of checks) {
    if (!report.ok) {
      issues.push(issue("operational_oauth_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }

  return {
    rows: checks.map((report) => ({
      checkId: report.checkId,
      ok: report.ok,
      issueCount: report.issueCount,
    })),
  };
}

export function buildOperationalOauthIntegrationSyncReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const issues = [];
  const scripts = packageScripts(root);

  const commandCoverage = validateCommands(root, config, scripts, issues);
  const syncJobs = validateMarkerRows(
    root,
    config.syncJobs,
    REQUIRED_SYNC_JOBS,
    "operational_oauth_sync_job",
    issues,
    scripts
  );
  const oauthNegativePaths = validateMarkerRows(
    root,
    config.oauthNegativePaths,
    REQUIRED_OAUTH_NEGATIVE_PATHS,
    "operational_oauth_negative_path",
    issues,
    scripts
  );
  const tokenRefreshOperations = validateMarkerRows(
    root,
    config.tokenRefreshOperations,
    REQUIRED_TOKEN_REFRESH_OPERATIONS,
    "operational_oauth_token_refresh",
    issues,
    scripts
  );
  const disconnectOperations = validateMarkerRows(
    root,
    config.disconnectOperations,
    REQUIRED_DISCONNECT_OPERATIONS,
    "operational_oauth_disconnect",
    issues,
    scripts
  );
  const runtimeInventory = analyzeRuntimeInventory(root, issues);
  const delegatedChecks = analyzeDelegatedChecks(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-oauth-integration-sync",
    generatedFrom: CONFIG_REL,
    commandCoverage,
    runtimeInventory,
    delegatedChecks: delegatedChecks.rows,
    syncJobs,
    oauthNegativePaths,
    tokenRefreshOperations,
    disconnectOperations,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues,
  };
}

function main() {
  const report = buildOperationalOauthIntegrationSyncReport(ROOT);
  if (WRITE) {
    writeJson(ROOT, ARTIFACT_REL, {
      ...report,
      artifact: ARTIFACT_REL,
      generatedBy: "scripts/check-operational-oauth-integration-sync.mjs --write",
    });
  } else {
    const expected = readJson(ROOT, ARTIFACT_REL, null);
    if (!expected) {
      report.issues.push(issue("operational_oauth_integration_sync_missing_artifact", { path: ARTIFACT_REL }));
      report.issueCount = report.issues.length;
      report.ok = false;
    } else {
      const current = {
        ...report,
        artifact: ARTIFACT_REL,
        generatedBy: "scripts/check-operational-oauth-integration-sync.mjs --write",
      };
      if (stableStringify(current) !== stableStringify(expected)) {
        report.issues.push(issue("operational_oauth_integration_sync_artifact_drift", { path: ARTIFACT_REL }));
        report.issueCount = report.issues.length;
        report.ok = false;
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
