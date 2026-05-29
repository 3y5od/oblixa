#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CONFIG_REL = "config/database-backup-restore-evidence.json";
const MANUAL_BOUNDARIES_REL = "config/operational-manual-boundaries.json";
const ARTIFACT_REL = "artifacts/supabase/database-backup-restore-evidence.json";
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

function scriptSourcePath(commandText) {
  const match = /\bnode\s+(scripts\/[A-Za-z0-9._/-]+\.mjs)\b/u.exec(commandText);
  return match?.[1] ?? null;
}

function validateCommandRows(root, config, packageScripts, issues) {
  const forbiddenPatterns = (config.forbiddenScriptPatterns ?? []).map((pattern) => new RegExp(pattern, "iu"));
  return (config.commands ?? [])
    .map((row) => {
      const script = row.command;
      const packageCommand = packageScripts[script] ?? null;
      const sourcePath = packageCommand ? scriptSourcePath(packageCommand) : null;
      const source = sourcePath ? read(root, sourcePath) : "";
      const findings = [];

      if (!packageCommand) {
        issues.push(issue("database_restore_evidence_missing_package_script", { script }));
        findings.push("missing_package_script");
      }
      if (row.mutatesProduction !== false) {
        issues.push(issue("database_restore_evidence_command_may_mutate_production", { script }));
        findings.push("mutates_production");
      }
      for (const envKey of row.strictEnvKeys ?? []) {
        if (sourcePath && !source.includes(envKey)) {
          issues.push(issue("database_restore_evidence_missing_strict_env_key", { script, sourcePath, envKey }));
          findings.push(`missing_env:${envKey}`);
        }
      }
      for (const pattern of forbiddenPatterns) {
        if (packageCommand && pattern.test(packageCommand)) {
          issues.push(issue("database_restore_evidence_forbidden_package_command", { script, pattern: String(pattern) }));
          findings.push("forbidden_package_command");
        }
        if (source && pattern.test(source)) {
          issues.push(issue("database_restore_evidence_forbidden_script_source", { script, sourcePath, pattern: String(pattern) }));
          findings.push("forbidden_script_source");
        }
      }

      return {
        command: script,
        packageCommand,
        sourcePath,
        purpose: row.purpose,
        strictEnvKeys: [...(row.strictEnvKeys ?? [])].sort((a, b) => a.localeCompare(b)),
        mutatesProduction: row.mutatesProduction,
        ok: findings.length === 0,
      };
    })
    .sort((a, b) => a.command.localeCompare(b.command));
}

export function buildDatabaseBackupRestoreEvidence(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const manualBoundaries = readJson(root, MANUAL_BOUNDARIES_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-database-backup-restore-evidence") {
    issues.push(issue("database_restore_evidence_invalid_config_metadata"));
  }

  const manualBoundary = (manualBoundaries.manualActions ?? []).find((row) => row.id === config.manualBoundaryId) ?? null;
  if (!manualBoundary) {
    issues.push(issue("database_restore_evidence_missing_manual_boundary", { manualBoundaryId: config.manualBoundaryId }));
  } else if (manualBoundary.readinessCommand !== "check:database-backup-restore-evidence") {
    issues.push(issue("database_restore_evidence_manual_boundary_wrong_readiness_command", {
      manualBoundaryId: config.manualBoundaryId,
      readinessCommand: manualBoundary.readinessCommand,
    }));
  }

  const expiry = Date.parse(`${config.rpoRto?.expiresOn ?? ""}T00:00:00Z`);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    issues.push(issue("database_restore_evidence_rpo_rto_review_expired", { expiresOn: config.rpoRto?.expiresOn ?? null }));
  }
  for (const key of ["rpoMinutes", "rtoMinutes"]) {
    if (!Number.isInteger(config.rpoRto?.[key]) || config.rpoRto[key] <= 0) {
      issues.push(issue("database_restore_evidence_invalid_rpo_rto_value", { key, value: config.rpoRto?.[key] ?? null }));
    }
  }

  const commands = validateCommandRows(root, config, packageScripts, issues);
  const redactionPolicy = config.redactionPolicy ?? {};
  if (redactionPolicy.mode !== "metadata-only" || redactionPolicy.allowedEnvEvidence !== "presence-only") {
    issues.push(issue("database_restore_evidence_invalid_redaction_policy"));
  }

  return {
    schemaVersion: 1,
    source: "code-owned-database-backup-restore-evidence",
    generatedBy: "scripts/check-database-backup-restore-evidence.mjs --write",
    generatedFrom: CONFIG_REL,
    manualBoundariesSource: MANUAL_BOUNDARIES_REL,
    manualBoundary: manualBoundary
      ? {
          id: manualBoundary.id,
          ownerArea: manualBoundary.ownerArea,
          externalSystem: manualBoundary.externalSystem,
          productionOnly: manualBoundary.productionOnly,
          readinessCommand: manualBoundary.readinessCommand,
        }
      : null,
    rpoRto: {
      rpoMinutes: config.rpoRto?.rpoMinutes ?? null,
      rtoMinutes: config.rpoRto?.rtoMinutes ?? null,
      source: config.rpoRto?.source ?? null,
      reviewedOn: config.rpoRto?.reviewedOn ?? null,
      expiresOn: config.rpoRto?.expiresOn ?? null,
    },
    commandCount: commands.length,
    commands,
    redactionPolicy,
    manualActions: [...(config.manualActions ?? [])].sort((a, b) => a.localeCompare(b)),
    issueCount: issues.length,
    issues,
  };
}

export function analyzeDatabaseBackupRestoreEvidence(root = ROOT, options = {}) {
  const report = buildDatabaseBackupRestoreEvidence(root);
  const artifactRel = options.artifactRel ?? ARTIFACT_REL;
  const artifactPath = path.join(root, artifactRel);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("database_restore_evidence_artifact_missing", { artifact: artifactRel }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("database_restore_evidence_artifact_drift", {
      artifact: artifactRel,
      writeCommand: "npm run write:database-backup-restore-evidence",
    }));
  }
  return {
    ...report,
    issueCount: issues.length,
    issues,
    ok: issues.length === 0,
  };
}

export function runDatabaseBackupRestoreEvidence(root = ROOT) {
  const report = buildDatabaseBackupRestoreEvidence(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ok: report.issueCount === 0, wrote: ARTIFACT_REL, ...report }));
    if (report.issueCount > 0) process.exitCode = 1;
    return report;
  }

  const checked = analyzeDatabaseBackupRestoreEvidence(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDatabaseBackupRestoreEvidence();
}
