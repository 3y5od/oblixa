#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeDatabaseBackupRestoreEvidence } from "./check-database-backup-restore-evidence.mjs";
import { analyzeMigrationIdempotency } from "./check-migration-idempotency.mjs";
import { analyzeMigrationManifest } from "./check-migration-manifest.mjs";
import { analyzeMigrationOrganization } from "./check-migration-organization.mjs";
import { analyzeMigrationSecurityPatterns } from "./check-migration-security-patterns.mjs";
import { analyzePrivacyInventory } from "./check-privacy-inventory.mjs";
import { analyzeRetentionPolicy } from "./check-retention-policy.mjs";
import { analyzeRlsPolicyDrift } from "./check-rls-policy-drift.mjs";
import { analyzeRlsSanityTables } from "./check-rls-sanity-tables.mjs";
import { analyzeSqlDefinerInvokerInventory } from "./check-sql-definer-invoker-inventory.mjs";
import { analyzeSqlSecurityAutomationCoverage } from "./check-sql-security-automation-coverage.mjs";
import { analyzeSupabaseRetentionInventory } from "./check-supabase-retention-inventory.mjs";
import { analyzeTenantTableSchemaConstraints } from "./check-tenant-table-schema-constraints.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-supabase-database.json";
const ARTIFACT_REL = "artifacts/operational-supabase-database.json";
const CI_REL = ".github/workflows/ci.yml";
const LINKED_READINESS_SOURCE_REL = "scripts/check-supabase-operational-readiness.mjs";
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

function findObjective(config, id) {
  return (config.objectives ?? []).find((row) => row.id === id) ?? null;
}

function commandRows(objective) {
  return objective?.commands ?? [];
}

function validateCommands(root, config, packageScripts, ci, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of commandRows(objective)) {
      const command = row.command;
      if (!packageScripts[command]) {
        issues.push(issue("operational_supabase_missing_package_script", { objective: objective.id, command }));
      }
      if (row.ciRequired && !ci.includes(commandText(command))) {
        issues.push(issue("operational_supabase_missing_ci_command", { objective: objective.id, command }));
      }
      rows.push({
        objective: objective.id,
        command,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent: Boolean(packageScripts[command]),
        ciPresent: ci.includes(commandText(command)),
      });
    }
  }

  for (const objective of config.objectives ?? []) {
    for (const rel of objective.artifacts ?? []) {
      if (!fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_supabase_missing_artifact", { objective: objective.id, path: rel }));
      }
    }
  }

  if (!ci.includes(commandText("check:operational-supabase-database"))) {
    issues.push(issue("operational_supabase_missing_aggregate_ci_command", {
      command: commandText("check:operational-supabase-database"),
    }));
  }

  return rows.sort((a, b) => `${a.objective}:${a.command}`.localeCompare(`${b.objective}:${b.command}`));
}

function validateMarkerFiles(root, config, issues) {
  const rows = [];
  const markerSources = [];
  for (const objective of config.objectives ?? []) {
    for (const fixture of objective.fixtures ?? []) markerSources.push({ objective: objective.id, ...fixture });
    for (const markerFile of objective.requiredMarkers ?? []) markerSources.push({ objective: objective.id, ...markerFile });
  }

  for (const markerFile of markerSources) {
    const text = read(root, markerFile.path);
    if (!text) {
      issues.push(issue("operational_supabase_missing_marker_file", { objective: markerFile.objective, path: markerFile.path }));
      rows.push({ objective: markerFile.objective, path: markerFile.path, ok: false, markerCount: markerFile.markers?.length ?? 0 });
      continue;
    }
    const missing = (markerFile.markers ?? []).filter((marker) => !text.includes(marker));
    for (const marker of missing) {
      issues.push(issue("operational_supabase_missing_marker", { objective: markerFile.objective, path: markerFile.path, marker }));
    }
    rows.push({
      objective: markerFile.objective,
      path: markerFile.path,
      ok: missing.length === 0,
      markerCount: markerFile.markers?.length ?? 0,
    });
  }

  return rows.sort((a, b) => `${a.objective}:${a.path}`.localeCompare(`${b.objective}:${b.path}`));
}

function validateLinkedProjectSafety(root, config, packageScripts, issues) {
  const objective = findObjective(config, "linked-project-safety");
  const source = read(root, LINKED_READINESS_SOURCE_REL);
  const rows = [];

  for (const marker of objective?.requiredSourceMarkers ?? []) {
    if (!source.includes(marker)) {
      issues.push(issue("operational_supabase_linked_readiness_missing_source_marker", {
        path: LINKED_READINESS_SOURCE_REL,
        marker,
      }));
    }
  }

  const forbiddenDefaultPatterns = (objective?.forbiddenDefaultCommandPatterns ?? []).map((pattern) => new RegExp(pattern, "iu"));
  for (const command of objective?.defaultCommands ?? []) {
    const text = packageScripts[command] ?? "";
    const matchedPattern = forbiddenDefaultPatterns.find((pattern) => pattern.test(text));
    if (matchedPattern) {
      issues.push(issue("operational_supabase_default_command_not_linked_safe", { command, pattern: String(matchedPattern) }));
    }
    rows.push({ command, commandClass: "default", packageScriptPresent: Boolean(text), linked: text.includes("--linked"), mutates: Boolean(matchedPattern) });
  }

  for (const command of objective?.optionalLinkedReadOnlyCommands ?? []) {
    const text = packageScripts[command] ?? "";
    if (!text.includes("--linked")) {
      issues.push(issue("operational_supabase_optional_linked_command_missing_linked_flag", { command }));
    }
    if (!/check-supabase-operational-readiness\.mjs/u.test(text)) {
      issues.push(issue("operational_supabase_optional_linked_command_unexpected_runner", { command }));
    }
    if (/\bsupabase\s+db\s+(?:push|reset|branch|dump|restore)\b|\bsupabase\s+migration\s+(?:up|repair)\b/iu.test(text)) {
      issues.push(issue("operational_supabase_optional_linked_command_mutating", { command }));
    }
    rows.push({ command, commandClass: "optional-linked-read-only", packageScriptPresent: Boolean(text), linked: text.includes("--linked"), mutates: false });
  }

  return rows.sort((a, b) => a.command.localeCompare(b.command));
}

function summarizeCheck(checkId, report, issues, fields = {}) {
  if (!report.ok) {
    issues.push(issue("operational_supabase_delegated_check_failed", {
      checkId,
      issueCount: report.issueCount ?? report.issues?.length ?? 0,
    }));
  }
  return {
    checkId,
    ok: Boolean(report.ok),
    issueCount: report.issueCount ?? report.issues?.length ?? 0,
    ...fields,
  };
}

function delegatedReports(root, issues) {
  const migrationManifest = analyzeMigrationManifest({ root });
  const migrationOrganization = analyzeMigrationOrganization({ root });
  const migrationIdempotency = analyzeMigrationIdempotency({ root });
  const migrationSecurity = analyzeMigrationSecurityPatterns(root, { strict: true });
  const rlsSanity = analyzeRlsSanityTables(root);
  const tenantConstraints = analyzeTenantTableSchemaConstraints(root);
  const rlsPolicyDrift = analyzeRlsPolicyDrift(root);
  const sqlSecurityCoverage = analyzeSqlSecurityAutomationCoverage({ root });
  const definerInvoker = analyzeSqlDefinerInvokerInventory(root, { checkArtifact: true });
  const retentionInventory = analyzeSupabaseRetentionInventory({ root });
  const retentionPolicy = analyzeRetentionPolicy(root);
  const privacyInventory = analyzePrivacyInventory(root);
  const backupRestore = analyzeDatabaseBackupRestoreEvidence(root);

  return [
    summarizeCheck("migration-manifest", migrationManifest, issues, {
      migrationCount: migrationManifest.migrationCount,
      latestVersion: migrationManifest.latestVersion,
    }),
    summarizeCheck("migration-organization", migrationOrganization, issues, {
      migrationCount: migrationOrganization.migrationCount,
      latestVersion: migrationOrganization.latestVersion,
    }),
    summarizeCheck("migration-idempotency", migrationIdempotency, issues, {
      findingCount: migrationIdempotency.findingCount,
      reviewedExceptionCount: migrationIdempotency.reviewedExceptionCount,
    }),
    summarizeCheck("migration-security-patterns", {
      ok: migrationSecurity.issueCount === 0,
      issueCount: migrationSecurity.issueCount,
      issues: migrationSecurity.issues,
    }, issues, {
      strict: migrationSecurity.strict,
    }),
    summarizeCheck("rls-sanity-tables", rlsSanity, issues, {
      tenantTableCount: rlsSanity.tenantTableCount,
    }),
    summarizeCheck("tenant-table-schema-constraints", tenantConstraints, issues),
    summarizeCheck("rls-policy-drift", rlsPolicyDrift, issues, {
      totalCreatedTables: rlsPolicyDrift.totalCreatedTables,
      totalPolicyProtectedTables: rlsPolicyDrift.totalPolicyProtectedTables,
    }),
    summarizeCheck("sql-security-automation-coverage", sqlSecurityCoverage, issues, {
      coverageCount: sqlSecurityCoverage.coverageCount,
      queueCoveredCount: sqlSecurityCoverage.queueCoveredCount,
    }),
    summarizeCheck("sql-definer-invoker-inventory", definerInvoker, issues, {
      securityDefinerFunctionCount: definerInvoker.securityDefinerFunctionCount,
      tenantViewCount: definerInvoker.tenantViewCount,
    }),
    summarizeCheck("supabase-retention-inventory", retentionInventory, issues, {
      policyCount: retentionInventory.policyCount,
    }),
    summarizeCheck("retention-policy", retentionPolicy, issues),
    summarizeCheck("privacy-inventory", privacyInventory, issues),
    summarizeCheck("database-backup-restore-evidence", backupRestore, issues, {
      commandCount: backupRestore.commandCount,
      manualBoundaryId: backupRestore.manualBoundary?.id ?? null,
    }),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));
}

export function buildOperationalSupabaseDatabaseReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-supabase-database") {
    issues.push(issue("operational_supabase_invalid_config_metadata"));
  }
  if (!Array.isArray(config.objectives) || config.objectives.length === 0) {
    issues.push(issue("operational_supabase_missing_objectives"));
  }

  const seen = new Set();
  for (const objective of config.objectives ?? []) {
    if (!objective.id || seen.has(objective.id)) {
      issues.push(issue("operational_supabase_invalid_or_duplicate_objective", { id: objective.id ?? null }));
    }
    seen.add(objective.id);
    if (!objective.ownerArea) {
      issues.push(issue("operational_supabase_objective_missing_owner", { id: objective.id ?? null }));
    }
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const markerFiles = validateMarkerFiles(root, config, issues);
  const linkedProjectSafety = validateLinkedProjectSafety(root, config, packageScripts, issues);
  const checks = delegatedReports(root, issues);

  return {
    schemaVersion: 1,
    source: "code-owned-operational-supabase-database",
    generatedBy: "scripts/check-operational-supabase-database.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    objectiveCount: config.objectives?.length ?? 0,
    commandCount: commands.length,
    markerFileCount: markerFiles.length,
    delegatedCheckCount: checks.length,
    commands,
    markerFiles,
    linkedProjectSafety,
    checks,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeOperationalSupabaseDatabase(root = ROOT) {
  const report = buildOperationalSupabaseDatabaseReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];

  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_supabase_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_supabase_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-supabase-database",
    }));
  }

  return {
    ...report,
    issueCount: issues.length,
    issues,
    ok: issues.length === 0,
  };
}

export function runOperationalSupabaseDatabase(root = ROOT) {
  const report = buildOperationalSupabaseDatabaseReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ok: report.issueCount === 0, wrote: ARTIFACT_REL, ...report }));
    if (report.issueCount > 0) process.exitCode = 1;
    return report;
  }

  const checked = analyzeOperationalSupabaseDatabase(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalSupabaseDatabase();
}
