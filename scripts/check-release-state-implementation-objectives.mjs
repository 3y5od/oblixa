#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CONFIG_REL = "config/release-state-implementation-objectives.json";
const ARTIFACT_REL = "artifacts/release-state-implementation-objectives.json";
const WRITE = process.argv.includes("--write");

const ALLOWED_DISPOSITIONS = new Set([
  "ship",
  "ship_simplify",
  "ship_gated",
  "contextual",
  "admin",
  "internal",
  "omit",
  "contained",
  "merge",
  "boundary",
]);

const EXPECTED_ROUTE_DISPOSITIONS = new Map([
  ["/", "ship"],
  ["/product", "ship"],
  ["/request-access", "ship_simplify"],
  ["/early-access", "merge"],
  ["/pricing", "ship_simplify"],
  ["/contact", "ship_simplify"],
  ["/security", "ship"],
  ["/privacy", "ship"],
  ["/terms", "ship"],
  ["/acceptable-use", "ship"],
  ["/accessibility", "ship"],
  ["/cookies", "ship"],
  ["/login", "ship"],
  ["/signup", "ship_gated"],
  ["/forgot-password", "ship"],
  ["/reset-password", "ship"],
  ["/auth/callback", "boundary"],
  ["/external/[token]", "contextual"],
  ["/external", "boundary"],
  ["/onboarding/calibration", "ship_simplify"],
  ["/dashboard", "ship"],
  ["/contracts", "ship"],
  ["/work", "ship"],
  ["/renewals", "ship"],
  ["/evidence", "ship"],
  ["/reports", "ship"],
  ["/settings", "ship"],
  ["/contracts/new", "contextual"],
  ["/contracts/bulk", "contextual"],
  ["/contracts/imports/[jobId]", "contextual"],
  ["/contracts/[id]", "ship"],
  ["/contracts/review", "contextual"],
  ["/search", "contextual"],
  ["/contracts/renewals", "merge"],
  ["/contracts/evidence-studio", "merge"],
  ["/contracts/tasks", "merge"],
  ["/contracts/obligations", "merge"],
  ["/contracts/approvals", "merge"],
  ["/contracts/exceptions", "merge"],
  ["/contracts/reports", "merge"],
  ["/settings/security", "ship"],
  ["/settings/billing", "admin"],
  ["/settings/operations", "omit"],
  ["/settings/health", "internal"],
  ["/settings/health/diagnostics", "internal"],
  ["/settings/product", "internal"],
  ["/settings/policy", "omit"],
  ["/settings/policy/registry", "internal"],
  ["/settings/policy/diagnostics", "internal"],
  ["/more", "omit"],
  ["/operator/access-requests", "internal"],
  ["/dashboard/persona", "contained"],
  ["/contracts/intake", "contained"],
  ["/contracts/data-quality", "contained"],
  ["/contracts/review-cadence", "contained"],
  ["/contracts/watchlists", "contained"],
  ["/contracts/execution-graph", "contained"],
  ["/contracts/approvals/workload", "contained"],
  ["/contracts/approvals/sla-simulator", "contained"],
  ["/contracts/analytics", "contained"],
  ["/contracts/collaboration", "contained"],
  ["/contracts/programs", "contained"],
  ["/contracts/maintenance", "internal"],
  ["/decisions", "contained"],
  ["/decisions/[id]", "contained"],
  ["/decisions/review", "contained"],
  ["/decisions/compare", "contained"],
  ["/campaigns", "contained"],
  ["/campaigns/[id]", "contained"],
  ["/campaigns/compare", "contained"],
  ["/relationship-workspaces", "contained"],
  ["/accounts/[key]", "contained"],
  ["/accounts", "boundary"],
  ["/counterparties/[key]", "contained"],
  ["/counterparties", "boundary"],
  ["/assurance", "contained"],
  ["/assurance/findings", "contained"],
  ["/assurance/findings/[id]", "contained"],
  ["/assurance/control-policies", "contained"],
  ["/assurance/control-policies/[id]", "contained"],
  ["/assurance/scorecards", "contained"],
  ["/assurance/playbooks", "contained"],
  ["/assurance/review-boards", "contained"],
  ["/assurance/segments", "contained"],
  ["/assurance/program-evolution", "contained"],
  ["/assurance/health-graph", "contained"],
  ["/assurance/autopilot", "contained"],
]);

const EXPECTED_ROUTES = [...EXPECTED_ROUTE_DISPOSITIONS.keys()];

const EXPECTED_EMAILS = [
  "invite-teammate",
  "first-contract-uploaded",
  "extraction-ready",
  "extraction-failed-or-manual-review-needed",
  "field-review-reminder",
  "upcoming-renewal-reminder",
  "notice-deadline-reminder",
  "work-item-assigned",
  "work-item-overdue",
  "evidence-requested",
  "evidence-overdue",
  "weekly-digest-when-stable",
];

const EXPECTED_BOUNDARY_PAGES = [
  "global-not-found",
  "marketing-not-found",
  "contract-not-found",
  "global-error",
];

const EXPECTED_COMPLETION_CRITERIA = [
  "core-primary-nav-seven-surfaces",
  "every-release-route-classified",
  "private-routes-hidden-from-core",
  "public-positioning-modest",
  "legal-trust-claims-bounded",
  "access-gated",
  "ai-human-review-boundary",
  "release-emails-operational",
  "billing-secondary",
  "telemetry-current",
  "artifacts-ci-wired",
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(rel) {
  const text = read(rel);
  if (!text) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(text);
}

function writeJson(rel, value) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts() {
  return readJson("package.json").scripts ?? {};
}

function commandExists(scripts, command) {
  return typeof command === "string" && Boolean(scripts[command]);
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] ?? "(missing)";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function validateRows({ rows, ids, idKey, issuePrefix, issues }) {
  const seen = new Set();
  const expected = new Set(ids);
  for (const row of rows) {
    const id = row[idKey];
    if (!id || typeof id !== "string") {
      issues.push(issue(`${issuePrefix}_missing_id`));
      continue;
    }
    if (seen.has(id)) issues.push(issue(`${issuePrefix}_duplicate_id`, { id }));
    seen.add(id);
    if (!expected.has(id)) issues.push(issue(`${issuePrefix}_unexpected_id`, { id }));
  }
  for (const id of ids) {
    if (!seen.has(id)) issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
  }
}

function validateCommandRows(rows, section, scripts, issues, options = {}) {
  const requireOwnerArea = options.requireOwnerArea !== false;
  for (const row of rows) {
    if (requireOwnerArea && (!row.ownerArea || typeof row.ownerArea !== "string")) {
      issues.push(issue("release_state_objective_missing_owner_area", { section, id: row.id ?? row.path ?? null }));
    }
    if (!commandExists(scripts, row.validationCommand)) {
      issues.push(issue("release_state_objective_unknown_validation_command", {
        section,
        id: row.id ?? row.path ?? null,
        validationCommand: row.validationCommand ?? null,
      }));
    }
  }
}

function buildReport(config, scripts) {
  const issues = [];
  if (config.schemaVersion !== 1 || config.source !== "code-owned-release-state-implementation-objectives") {
    issues.push(issue("release_state_invalid_config_metadata"));
  }

  const objectives = Array.isArray(config.objectives) ? config.objectives : [];
  const routes = Array.isArray(config.routeDispositions) ? config.routeDispositions : [];
  const boundaryPages = Array.isArray(config.boundaryPages) ? config.boundaryPages : [];
  const emails = Array.isArray(config.requiredEmails) ? config.requiredEmails : [];
  const completionCriteria = Array.isArray(config.completionCriteria) ? config.completionCriteria : [];
  const manualBoundaries = Array.isArray(config.manualBoundaries) ? config.manualBoundaries : [];

  validateRows({ rows: routes, ids: EXPECTED_ROUTES, idKey: "path", issuePrefix: "release_state_route", issues });
  validateRows({ rows: emails, ids: EXPECTED_EMAILS, idKey: "id", issuePrefix: "release_state_email", issues });
  validateRows({
    rows: boundaryPages,
    ids: EXPECTED_BOUNDARY_PAGES,
    idKey: "id",
    issuePrefix: "release_state_boundary_page",
    issues,
  });
  validateRows({
    rows: completionCriteria,
    ids: EXPECTED_COMPLETION_CRITERIA,
    idKey: "id",
    issuePrefix: "release_state_completion_criterion",
    issues,
  });
  validateCommandRows(objectives, "objectives", scripts, issues);
  validateCommandRows(routes, "routeDispositions", scripts, issues);
  validateCommandRows(boundaryPages, "boundaryPages", scripts, issues);
  validateCommandRows(emails, "requiredEmails", scripts, issues);
  validateCommandRows(completionCriteria, "completionCriteria", scripts, issues, { requireOwnerArea: false });
  validateCommandRows(manualBoundaries, "manualBoundaries", scripts, issues);

  const objectiveIds = new Set();
  for (const row of objectives) {
    if (!row.id || objectiveIds.has(row.id)) issues.push(issue("release_state_objective_invalid_or_duplicate_id", { id: row.id ?? null }));
    objectiveIds.add(row.id);
    if (!Array.isArray(row.scope) || row.scope.length === 0) {
      issues.push(issue("release_state_objective_missing_scope", { id: row.id ?? null }));
    }
    if (row.artifact && row.artifact !== ARTIFACT_REL && !read(row.artifact)) {
      issues.push(issue("release_state_objective_missing_artifact", { id: row.id ?? null, artifact: row.artifact }));
    }
  }

  for (const row of routes) {
    if (!ALLOWED_DISPOSITIONS.has(row.disposition)) {
      issues.push(issue("release_state_route_unknown_disposition", { path: row.path, disposition: row.disposition ?? null }));
    }
    const expectedDisposition = EXPECTED_ROUTE_DISPOSITIONS.get(row.path);
    if (expectedDisposition && row.disposition !== expectedDisposition) {
      issues.push(issue("release_state_route_disposition_mismatch", {
        path: row.path,
        expectedDisposition,
        actualDisposition: row.disposition ?? null,
      }));
    }
    if ((row.disposition === "contained" || row.disposition === "omit") && row.validationCommand !== "check:surface:hrefs:strict") {
      issues.push(issue("release_state_hidden_route_missing_surface_guard_validation", { path: row.path }));
    }
    if ((row.disposition === "ship" || row.disposition === "ship_simplify" || row.disposition === "ship_gated") && row.validationCommand === "check:surface:hrefs:strict") {
      issues.push(issue("release_state_shipped_route_uses_only_hidden_surface_validation", { path: row.path }));
    }
  }

  for (const row of boundaryPages) {
    if (row.disposition !== "boundary") {
      issues.push(issue("release_state_boundary_page_wrong_disposition", { id: row.id, disposition: row.disposition ?? null }));
    }
  }

  for (const row of manualBoundaries) {
    if (!row.validationCommand) issues.push(issue("release_state_manual_boundary_missing_validation", { id: row.id ?? null }));
  }

  const routeDispositionCounts = countBy(routes, "disposition");
  const routeOwnerCounts = countBy(routes, "ownerArea");

  return {
    schemaVersion: 1,
    source: "code-owned-release-state-implementation-objectives",
    generatedBy: "scripts/check-release-state-implementation-objectives.mjs --write",
    generatedFrom: CONFIG_REL,
    objectiveCount: objectives.length,
    routeCount: routes.length,
    expectedRouteCount: EXPECTED_ROUTES.length,
    boundaryPageCount: boundaryPages.length,
    expectedBoundaryPageCount: EXPECTED_BOUNDARY_PAGES.length,
    requiredEmailCount: emails.length,
    expectedEmailCount: EXPECTED_EMAILS.length,
    completionCriterionCount: completionCriteria.length,
    manualBoundaryCount: manualBoundaries.length,
    routeDispositionCounts,
    routeOwnerCounts,
    hiddenOrInternalRouteCount: routes.filter((row) => row.disposition === "contained" || row.disposition === "internal" || row.disposition === "omit").length,
    commandCount: new Set([
      ...objectives.map((row) => row.validationCommand),
      ...routes.map((row) => row.validationCommand),
      ...boundaryPages.map((row) => row.validationCommand),
      ...emails.map((row) => row.validationCommand),
      ...completionCriteria.map((row) => row.validationCommand),
      ...manualBoundaries.map((row) => row.validationCommand),
    ].filter(Boolean)).size,
    objectives: objectives
      .map((row) => ({
        id: row.id,
        ownerArea: row.ownerArea,
        validationCommand: row.validationCommand,
        artifact: row.artifact ?? null,
        manualBoundary: row.manualBoundary === true,
        scope: [...(row.scope ?? [])].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    routeDispositions: routes
      .map((row) => ({
        path: row.path,
        disposition: row.disposition,
        ownerArea: row.ownerArea,
        validationCommand: row.validationCommand,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    boundaryPages: boundaryPages
      .map((row) => ({
        id: row.id,
        disposition: row.disposition,
        ownerArea: row.ownerArea,
        validationCommand: row.validationCommand,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    requiredEmails: emails
      .map((row) => ({
        id: row.id,
        ownerArea: row.ownerArea,
        validationCommand: row.validationCommand,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    completionCriteria: completionCriteria
      .map((row) => ({
        id: row.id,
        validationCommand: row.validationCommand,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    manualBoundaries: manualBoundaries
      .map((row) => ({
        id: row.id,
        ownerArea: row.ownerArea,
        validationCommand: row.validationCommand,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    issueCount: issues.length,
    issues,
  };
}

export function analyzeReleaseStateImplementationObjectives() {
  const config = readJson(CONFIG_REL);
  const current = buildReport(config, packageScripts());
  const existing = read(ARTIFACT_REL);
  const issues = [...current.issues];
  if (!existing) {
    issues.push(issue("release_state_implementation_artifact_missing", { path: ARTIFACT_REL }));
  } else if (existing !== stableStringify(current)) {
    issues.push(issue("release_state_implementation_artifact_drift", {
      path: ARTIFACT_REL,
      fix: "npm run write:release-state-implementation-objectives",
    }));
  }
  return {
    ok: issues.length === 0,
    ...current,
    issueCount: issues.length,
    issues,
  };
}

export function runReleaseStateImplementationObjectivesCheck() {
  const config = readJson(CONFIG_REL);
  const current = buildReport(config, packageScripts());
  if (WRITE) {
    writeJson(ARTIFACT_REL, current);
    console.log(stableStringify({ ok: true, wrote: ARTIFACT_REL, routeCount: current.routeCount, objectiveCount: current.objectiveCount }));
    return current;
  }
  const report = analyzeReleaseStateImplementationObjectives();
  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReleaseStateImplementationObjectivesCheck();
}
