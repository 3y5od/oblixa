#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeDeterministicOrgResolution } from "./check-deterministic-org-resolution.mjs";
import { analyzeRoleCapabilityInventory } from "./check-role-capability-inventory.mjs";
import { analyzeSensitiveActionStepUp } from "./check-sensitive-action-step-up.mjs";
import { analyzeServerActionNegativeTests } from "./check-server-action-negative-tests.mjs";
import { analyzeSessionLifecycleSecurity } from "./check-session-lifecycle-security.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-authz-session.json";
const ARTIFACT_REL = "artifacts/operational-authz-session.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");

const API_AUTH_SIGNALS = [
  /\bgetApiAuthContext\b/,
  /\bgetAuthContext\b/,
  /\.auth\.getUser\s*\(/,
  /\bcreateClient\s*\(/,
  /\bcreateServerClient\s*\(/,
  /\bcanManageCapability\b/,
  /\bwith(?:V6)?CronRoute\b|\brunCronRoute\b/,
  /\bauthorizeCronRequest\b|\bgateCronRequest\b|\bCRON_SECRET\b/,
  /\brequireBearerSecret\b/,
  /\bisInboundAutomationAuthorized\b/,
  /\bconstructEvent\b|stripe-signature/i,
  /\bparseBearerToken\b|\bx-api-key\b/i,
  /\[token\]/,
];

const API_DENY_SIGNALS = [
  /status:\s*401\b/,
  /status:\s*403\b/,
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /\bNextResponse\.redirect\b[\s\S]{0,200}\/login/,
  /\bnotFound\s*\(/,
  /\breturn\s+deny\b/,
  /\breturn\s+cronDenied\b/,
];

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

function walk(root, dirRel, predicate, acc = []) {
  const dir = path.join(root, dirRel);
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walk(root, path.relative(root, abs), predicate, acc);
    } else if (predicate(name, abs)) {
      acc.push(abs);
    }
  }
  return acc;
}

function loadPublicApiAllowlist(root) {
  const entries = new Set();
  const text = read(root, "scripts/api-route-public-allowlist.txt");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    entries.add(trimmed.replace(/\\/g, "/"));
  }
  return entries;
}

function collectApiRouteMatrix(root, config, issues) {
  const apiRoot = path.join(root, "src", "app", "api");
  const allowlist = loadPublicApiAllowlist(root);
  const routePolicies = (config.surfacePolicies ?? [])
    .filter((policy) => typeof policy.routeMatch === "string")
    .map((policy) => ({ ...policy, re: new RegExp(policy.routeMatch) }));
  const rows = [];

  for (const abs of walk(root, "src/app/api", (name) => name === "route.ts").sort()) {
    const rel = path.relative(apiRoot, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    const publicAllowlisted = allowlist.has(rel);
    const authSignalCount = API_AUTH_SIGNALS.filter((re) => re.test(source)).length + Number(rel.includes("[token]"));
    const denySignalCount = API_DENY_SIGNALS.filter((re) => re.test(source)).length;
    const policyIds = routePolicies
      .filter((policy) => policy.re.test(rel))
      .map((policy) => policy.id)
      .sort((a, b) => a.localeCompare(b));
    if (!publicAllowlisted && policyIds.length === 0) {
      issues.push(issue("operational_authz_protected_route_missing_policy", { route: rel }));
    }
    rows.push({
      route: rel,
      publicAllowlisted,
      protected: !publicAllowlisted,
      authSignalCount,
      denySignalCount,
      policyIds,
    });
  }

  return rows.sort((a, b) => a.route.localeCompare(b.route));
}

function collectServerActionMatrix(root, config, issues) {
  const actionPolicies = (config.surfacePolicies ?? [])
    .filter((policy) => typeof policy.actionMatch === "string")
    .map((policy) => ({ ...policy, re: new RegExp(policy.actionMatch) }));
  const rows = [];
  for (const abs of walk(root, "src/actions", (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")).sort()) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    if (!/^\s*["']use server["']\s*;?/m.test(source)) continue;
    const exports = [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((match) => match[1]).sort();
    if (exports.length === 0) continue;
    const policyIds = actionPolicies
      .filter((policy) => policy.re.test(rel))
      .map((policy) => policy.id)
      .sort((a, b) => a.localeCompare(b));
    if (policyIds.length === 0) {
      issues.push(issue("operational_authz_server_action_missing_policy", { file: rel }));
    }
    rows.push({ file: rel, exportCount: exports.length, exports, policyIds });
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file));
}

function validateCommands(root, config, packageScripts, ci, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_authz_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_authz_missing_ci_command", { objective: objective.id, script }));
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
        issues.push(issue("operational_authz_missing_objective_artifact", { objective: objective.id, path: rel }));
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
      issues.push(issue("operational_authz_missing_marker_file", { path: markerFile.path }));
    } else {
      for (const marker of markerFile.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue("operational_authz_missing_marker", { path: markerFile.path, marker }));
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

function validateMatrixMetadata(root, config, issues) {
  const requiredPrincipals = ["public", "authenticated", "owner", "admin", "member", "viewer", "external_token", "service_role"];
  const requiredModes = ["core", "advanced", "assurance"];
  const principals = new Set(config.principalClasses ?? []);
  const modes = new Set(config.workspaceModes ?? []);
  const accessControlSource = read(root, "src/lib/access-control.ts");
  const roleRows = [...(config.roleCapabilities ?? [])].sort((a, b) => String(a.role).localeCompare(String(b.role)));

  for (const principal of requiredPrincipals) {
    if (!principals.has(principal)) issues.push(issue("operational_authz_missing_principal_class", { principal }));
  }
  for (const mode of requiredModes) {
    if (!modes.has(mode)) issues.push(issue("operational_authz_missing_workspace_mode", { mode }));
  }
  for (const row of roleRows) {
    if (!accessControlSource.includes(row.role)) {
      issues.push(issue("operational_authz_role_not_present_in_source", { role: row.role }));
    }
    for (const capability of row.capabilities ?? []) {
      if (!accessControlSource.includes(capability)) {
        issues.push(issue("operational_authz_capability_not_present_in_source", { role: row.role, capability }));
      }
    }
  }

  return {
    principalClasses: [...principals].sort((a, b) => a.localeCompare(b)),
    workspaceModes: [...modes].sort((a, b) => a.localeCompare(b)),
    roleCapabilities: roleRows.map((row) => ({
      role: row.role,
      capabilities: [...(row.capabilities ?? [])].sort((a, b) => a.localeCompare(b)),
    })),
  };
}

function validateScenarioRegistries(config, markerFiles, issues) {
  const scenarioGroups = [
    ["orgResolutionScenarios", ["missing_actor", "missing_org", "multiple_orgs", "inactive_org", "suspended_org", "stale_selected_org", "cross_org_path_parameter"]],
    ["sessionLifecycleTransitions", ["sign_in", "sign_out", "password_reset", "auth_callback", "expired_session", "stale_cookies", "session_fixation", "mfa_required_org", "account_recovery_abuse"]],
    ["sensitiveActionProofs", ["valid_step_up_cookie", "aal2_session", "missing_proof", "expired_proof", "wrong_user_or_org_proof"]],
  ];
  const rows = [];
  for (const [key, required] of scenarioGroups) {
    const values = new Set(config[key] ?? []);
    for (const value of required) {
      if (!values.has(value)) issues.push(issue("operational_authz_missing_scenario", { group: key, value }));
    }
    rows.push({ group: key, count: values.size, values: [...values].sort((a, b) => a.localeCompare(b)) });
  }
  const missingMarkerFiles = markerFiles.filter((row) => !row.ok).map((row) => row.path);
  return { groups: rows, missingMarkerFiles };
}

function normalizeReport(checkId, report) {
  return {
    checkId,
    ok: Boolean(report.ok ?? report.issueCount === 0),
    issueCount: Number(report.issueCount ?? report.issues?.length ?? 0),
  };
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("role-capability-inventory", analyzeRoleCapabilityInventory(root)),
    normalizeReport("deterministic-org-resolution", analyzeDeterministicOrgResolution(root)),
    normalizeReport("session-lifecycle-security", analyzeSessionLifecycleSecurity(root)),
    normalizeReport("sensitive-action-step-up", analyzeSensitiveActionStepUp(root)),
    normalizeReport("server-action-negative-tests", analyzeServerActionNegativeTests(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_authz_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalAuthzSessionReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-authz-session") {
    issues.push(issue("operational_authz_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const markerFiles = validateMarkers(root, config, issues);
  const accessMatrix = validateMatrixMetadata(root, config, issues);
  const apiRoutes = collectApiRouteMatrix(root, config, issues);
  const serverActions = collectServerActionMatrix(root, config, issues);
  const scenarioRegistry = validateScenarioRegistries(config, markerFiles, issues);
  const checks = delegatedReports(root, issues);
  const protectedApiRoutes = apiRoutes.filter((row) => row.protected);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-authz-session",
    generatedBy: "scripts/check-operational-authz-session.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    markerFileCount: markerFiles.length,
    principalClassCount: accessMatrix.principalClasses.length,
    workspaceModeCount: accessMatrix.workspaceModes.length,
    roleCapabilityRowCount: accessMatrix.roleCapabilities.length,
    apiRouteCount: apiRoutes.length,
    protectedApiRouteCount: protectedApiRoutes.length,
    serverActionFileCount: serverActions.length,
    serverActionExportCount: serverActions.reduce((total, row) => total + row.exportCount, 0),
    scenarioGroupCount: scenarioRegistry.groups.length,
    delegatedCheckCount: checks.length,
    commands,
    markerFiles,
    accessMatrix,
    apiRoutes,
    serverActions,
    scenarioRegistry,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalAuthzSession(root = ROOT) {
  const report = buildOperationalAuthzSessionReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_authz_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_authz_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-authz-session",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function runOperationalAuthzSession(root = ROOT) {
  const report = buildOperationalAuthzSessionReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }
  const checked = analyzeOperationalAuthzSession(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalAuthzSession();
}
