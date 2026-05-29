#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-release-readiness.json";
const MANUAL_BOUNDARIES_REL = "config/operational-manual-boundaries.json";
const ARTIFACT_REL = "artifacts/operational-release-readiness.json";
const WRITE = process.argv.includes("--write");

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function fileHash(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts() {
  return readJson("package.json").scripts ?? {};
}

function validateCommand(scripts, command, context, issues) {
  if (!command || typeof command !== "string") {
    issues.push(issue("operational_release_missing_command", context));
    return;
  }
  if (!scripts[command]) {
    issues.push(issue("operational_release_unknown_command", { ...context, command }));
  }
}

function validateArray(value, name, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(issue("operational_release_missing_array", { name }));
    return [];
  }
  return value;
}

function buildReport(config, manualBoundaries, scripts) {
  const issues = [];
  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-release-readiness") {
    issues.push(issue("operational_release_invalid_config_metadata"));
  }

  const riskClasses = new Set((manualBoundaries.environmentRiskClasses ?? []).map((row) => row.id));
  const releaseChecks = validateArray(config.releaseChecks, "releaseChecks", issues);
  const environmentContracts = validateArray(config.environmentContracts, "environmentContracts", issues);
  const rollbackReadiness = validateArray(config.rollbackReadiness, "rollbackReadiness", issues);
  const blockerTaxonomy = validateArray(config.blockerTaxonomy, "blockerTaxonomy", issues);
  const requiredFiles = validateArray(config.evidenceBundle?.requiredFiles, "evidenceBundle.requiredFiles", issues);

  const seenIds = new Set();
  for (const row of releaseChecks) {
    if (!row.id || seenIds.has(row.id)) issues.push(issue("operational_release_invalid_or_duplicate_release_check_id", { id: row.id }));
    seenIds.add(row.id);
    validateCommand(scripts, row.command, { id: row.id, section: "releaseChecks" }, issues);
    if (!row.objective) issues.push(issue("operational_release_check_missing_objective", { id: row.id }));
    if (!row.blockerClass) issues.push(issue("operational_release_check_missing_blocker_class", { id: row.id }));
    if (!riskClasses.has(row.environmentRiskClass)) {
      issues.push(issue("operational_release_unknown_environment_risk_class", { id: row.id, environmentRiskClass: row.environmentRiskClass }));
    }
    if (typeof row.required !== "boolean") issues.push(issue("operational_release_check_missing_required_boolean", { id: row.id }));
  }

  for (const row of environmentContracts) {
    validateCommand(scripts, row.command, { id: row.id, section: "environmentContracts" }, issues);
    if (!Array.isArray(row.environments) || row.environments.length === 0) {
      issues.push(issue("operational_release_env_contract_missing_environments", { id: row.id }));
    }
    if (!Array.isArray(row.detects) || row.detects.length === 0) {
      issues.push(issue("operational_release_env_contract_missing_detection_list", { id: row.id }));
    }
  }

  const evidenceFiles = requiredFiles
    .map((row) => {
      const hash = fileHash(row.path);
      if (!hash) issues.push(issue("operational_release_evidence_file_missing", { name: row.name, path: row.path }));
      return { name: row.name, path: row.path, sha256: hash };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const row of rollbackReadiness) {
    validateCommand(scripts, row.validationCommand, { id: row.id, section: "rollbackReadiness" }, issues);
    if (!Array.isArray(row.requiredFields) || row.requiredFields.length === 0) {
      issues.push(issue("operational_release_rollback_missing_required_fields", { id: row.id }));
    }
    if (!row.manualBoundary) issues.push(issue("operational_release_rollback_missing_manual_boundary", { id: row.id }));
  }

  for (const row of blockerTaxonomy) {
    validateCommand(scripts, row.validationCommand, { id: row.id, section: "blockerTaxonomy" }, issues);
    for (const key of ["id", "category", "severity", "nextAction"]) {
      if (!row[key] || !String(row[key]).trim()) {
        issues.push(issue("operational_release_blocker_missing_field", { id: row.id ?? "(missing)", key }));
      }
    }
  }

  return {
    schemaVersion: 1,
    source: "code-owned-operational-release-readiness",
    generatedFrom: CONFIG_REL,
    manualBoundariesSource: MANUAL_BOUNDARIES_REL,
    commitSha: gitSha(),
    releaseCheckCount: releaseChecks.length,
    requiredReleaseCheckCount: releaseChecks.filter((row) => row.required).length,
    environmentContractCount: environmentContracts.length,
    rollbackReadinessCount: rollbackReadiness.length,
    blockerClassCount: blockerTaxonomy.length,
    evidenceBundle: {
      id: config.evidenceBundle?.id,
      redactionPolicy: config.evidenceBundle?.redactionPolicy,
      commandResultPolicy: config.evidenceBundle?.commandResultPolicy,
      sentryReleaseIdPolicy: "check:release-evidence records release ids when SENTRY_RELEASE or NEXT_PUBLIC_SENTRY_RELEASE is present",
      files: evidenceFiles,
    },
    blockerCategories: [...new Set(blockerTaxonomy.map((row) => row.category))].sort(),
    releaseChecks: releaseChecks
      .map((row) => ({
        id: row.id,
        command: row.command,
        required: row.required,
        blockerClass: row.blockerClass,
        environmentRiskClass: row.environmentRiskClass,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    environmentContracts: environmentContracts
      .map((row) => ({
        id: row.id,
        command: row.command,
        environments: [...(Array.isArray(row.environments) ? row.environments : [])].sort((a, b) => a.localeCompare(b)),
        detects: [...(Array.isArray(row.detects) ? row.detects : [])].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    rollbackReadiness: rollbackReadiness
      .map((row) => ({
        id: row.id,
        validationCommand: row.validationCommand,
        requiredFields: [...(Array.isArray(row.requiredFields) ? row.requiredFields : [])].sort((a, b) => a.localeCompare(b)),
        manualBoundary: row.manualBoundary,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    blockerTaxonomy: blockerTaxonomy
      .map((row) => ({
        id: row.id,
        category: row.category,
        severity: row.severity,
        validationCommand: row.validationCommand,
        nextAction: row.nextAction,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    issueCount: issues.length,
    issues,
  };
}

function main() {
  let config;
  let manualBoundaries;
  let scripts;
  try {
    config = readJson(CONFIG_REL);
    manualBoundaries = readJson(MANUAL_BOUNDARIES_REL);
    scripts = packageScripts();
  } catch (error) {
    console.error(stableStringify({ ok: false, error: error.message }));
    process.exit(1);
  }

  const report = buildReport(config, manualBoundaries, scripts);
  const serialized = stableStringify(report);
  const artifactPath = path.join(ROOT, ARTIFACT_REL);

  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, serialized);
  } else if (!fs.existsSync(artifactPath)) {
    report.issues.push(issue("operational_release_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    report.issues.push(issue("operational_release_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-release-readiness" }));
    report.issueCount = report.issues.length;
  }

  if (report.issueCount > 0) {
    console.error(stableStringify({ ok: false, ...report }));
    process.exit(1);
  }
  console.log(stableStringify({ ok: true, ...report }));
}

main();
