#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeExportSecurityGuards } from "./check-export-security-guards.mjs";
import { analyzeReportRedactionContract } from "./check-report-redaction-contract.mjs";
import { analyzeTelemetryEventInventory } from "./check-telemetry-event-inventory.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-search-reporting-analytics-exports.json";
const ARTIFACT_REL = "artifacts/operational-search-reporting-analytics-exports.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_SEARCH_DIMENSIONS = new Set([
  "query-length",
  "special-characters",
  "unicode-normalization",
  "empty-query",
  "pagination",
  "authorization",
  "rate-limits",
  "ranking-determinism",
  "cross-org-isolation",
]);

const REQUIRED_REPORTING_CLASSES = new Set([
  "report-generation",
  "scheduled-reports",
  "report-subscriptions",
  "stale-report-data",
  "failed-generation",
  "retry",
  "redaction",
  "export-limits",
]);

const REQUIRED_SPREADSHEET_ATTACK_CLASSES = new Set([
  "formula-prefixes",
  "delimiter-abuse",
  "newline-injection",
  "unicode-controls",
  "malicious-filenames",
  "export-route-coverage",
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

function commandText(script) {
  return `npm run ${script}`;
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
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
        issues.push(issue("operational_search_reporting_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_search_reporting_missing_ci_command", { objective: objective.id, script }));
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
        issues.push(issue("operational_search_reporting_missing_objective_artifact", { objective: objective.id, path: rel }));
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
    if (seen.has(row.id)) {
      issues.push(issue(`${issuePrefix}_duplicate_id`, { id: row.id }));
    }
    seen.add(row.id);
    if (typeof row.owner !== "string" || !row.owner.startsWith("@")) {
      issues.push(issue(`${issuePrefix}_missing_owner`, { id: row.id, owner: row.owner ?? null }));
    }
    if (!validationCommandExists(scripts, row.validationCommand)) {
      issues.push(issue(`${issuePrefix}_missing_validation_command`, { id: row.id, validationCommand: row.validationCommand ?? null }));
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
    if (!seen.has(id)) {
      issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
    }
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function analyzeDelegatedChecks(root, config, issues) {
  const telemetry = analyzeTelemetryEventInventory({
    root,
    inventoryRel: config.analyticsEventGovernance?.inventory ?? "artifacts/telemetry/event-inventory.json",
  });
  const exportSecurity = analyzeExportSecurityGuards(root);
  const reportRedaction = analyzeReportRedactionContract(root);

  if (!telemetry.ok) {
    issues.push(issue("operational_search_reporting_delegated_check_failed", {
      checkId: "telemetry-event-inventory",
      issueCount: telemetry.issueCount,
    }));
  }
  if (!exportSecurity.ok) {
    issues.push(issue("operational_search_reporting_delegated_check_failed", {
      checkId: "export-security-guards",
      issueCount: exportSecurity.issueCount,
    }));
  }
  if (!reportRedaction.ok) {
    issues.push(issue("operational_search_reporting_delegated_check_failed", {
      checkId: "report-redaction-contract",
      issueCount: reportRedaction.issueCount,
    }));
  }

  return {
    telemetry,
    rows: [
      {
        checkId: "telemetry-event-inventory",
        ok: telemetry.ok,
        issueCount: telemetry.issueCount,
        eventCount: telemetry.eventCount,
        compatibilitySensitiveCount: telemetry.compatibilitySensitiveCount,
      },
      {
        checkId: "export-security-guards",
        ok: exportSecurity.ok,
        issueCount: exportSecurity.issueCount,
        checkedFileCount: Object.keys(exportSecurity.issues ?? {}).length,
      },
      {
        checkId: "report-redaction-contract",
        ok: reportRedaction.ok,
        issueCount: reportRedaction.issueCount,
        checkedFileCount: reportRedaction.checkedFileCount,
      },
    ],
  };
}

function analyzeAnalyticsEventGovernance(config, delegated, issues) {
  const eventClassPolicies = new Map(
    (config.analyticsEventGovernance?.eventClassPolicies ?? []).map((row) => [row.eventClass, row])
  );
  const requiredFields = new Set(config.analyticsEventGovernance?.requiredFields ?? []);
  const telemetry = delegated.telemetry;
  const events = telemetry.current?.events ?? [];
  const rows = [];

  for (const event of events) {
    const owners = new Set();
    const sensitivityClasses = new Set();
    const retentionClasses = new Set();
    const destinations = new Set(event.compatibilityConsumers ?? []);
    const missingPolicyClasses = [];

    for (const eventClass of event.eventClasses ?? []) {
      const policy = eventClassPolicies.get(eventClass);
      if (!policy) {
        missingPolicyClasses.push(eventClass);
        continue;
      }
      if (policy.owner) owners.add(policy.owner);
      if (policy.sensitivityClass) sensitivityClasses.add(policy.sensitivityClass);
      if (policy.retentionClass) retentionClasses.add(policy.retentionClass);
      for (const destination of policy.destinations ?? []) destinations.add(destination);
    }

    if (missingPolicyClasses.length > 0) {
      issues.push(issue("operational_search_reporting_event_class_policy_missing", {
        eventName: event.eventName,
        missingPolicyClasses,
      }));
    }

    const row = {
      eventName: event.eventName,
      payloadSchema: [...(event.eventClasses ?? [])].sort((a, b) => a.localeCompare(b)),
      sensitivityClass: [...sensitivityClasses].sort((a, b) => a.localeCompare(b)),
      retentionClass: [...retentionClasses].sort((a, b) => a.localeCompare(b)),
      owner: [...owners].sort((a, b) => a.localeCompare(b)),
      destinations: [...destinations].sort((a, b) => a.localeCompare(b)),
      sourceCount: event.sources?.length ?? 0,
      compatibilitySensitive: Boolean(event.compatibilitySensitive),
    };

    for (const field of requiredFields) {
      const value = row[field];
      if (Array.isArray(value) ? value.length === 0 : value == null || value === "") {
        issues.push(issue("operational_search_reporting_event_governance_field_missing", {
          eventName: event.eventName,
          field,
        }));
      }
    }

    rows.push(row);
  }

  return {
    inventory: config.analyticsEventGovernance?.inventory ?? null,
    eventCount: rows.length,
    eventClassPolicyCount: eventClassPolicies.size,
    requiredFields: [...requiredFields].sort((a, b) => a.localeCompare(b)),
    events: rows.sort((a, b) => a.eventName.localeCompare(b.eventName)),
  };
}

export function buildOperationalSearchReportingAnalyticsExportsReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const scripts = packageScripts(root);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-search-reporting-analytics-exports") {
    issues.push(issue("operational_search_reporting_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, scripts, issues);
  const searchBehavior = validateMarkerRows(
    root,
    config.searchBehavior,
    REQUIRED_SEARCH_DIMENSIONS,
    "operational_search_reporting_search",
    issues,
    scripts
  );
  const reportingWorkflows = validateMarkerRows(
    root,
    config.reportingWorkflows,
    REQUIRED_REPORTING_CLASSES,
    "operational_search_reporting_report",
    issues,
    scripts
  );
  const spreadsheetInjection = validateMarkerRows(
    root,
    config.spreadsheetInjection,
    REQUIRED_SPREADSHEET_ATTACK_CLASSES,
    "operational_search_reporting_spreadsheet",
    issues,
    scripts
  );
  const delegated = analyzeDelegatedChecks(root, config, issues);
  const analyticsEventGovernance = analyzeAnalyticsEventGovernance(config, delegated, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-search-reporting-analytics-exports",
    generatedBy: "scripts/check-operational-search-reporting-analytics-exports.mjs --write",
    generatedFrom: CONFIG_REL,
    commandCount: commands.length,
    searchBehaviorCount: searchBehavior.length,
    reportingWorkflowCount: reportingWorkflows.length,
    spreadsheetAttackClassCount: spreadsheetInjection.length,
    analyticsEventCount: analyticsEventGovernance.eventCount,
    delegatedCheckCount: delegated.rows.length,
    commands,
    searchBehavior,
    reportingWorkflows,
    analyticsEventGovernance,
    spreadsheetInjection,
    delegatedChecks: delegated.rows,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalSearchReportingAnalyticsExports(root = ROOT) {
  const report = buildOperationalSearchReportingAnalyticsExportsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_search_reporting_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_search_reporting_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-search-reporting-analytics-exports",
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
    const report = buildOperationalSearchReportingAnalyticsExportsReport();
    writeJson(ROOT, ARTIFACT_REL, report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const report = analyzeOperationalSearchReportingAnalyticsExports();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
