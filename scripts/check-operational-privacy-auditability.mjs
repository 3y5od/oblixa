#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeAuditEventCoverage } from "./check-audit-event-coverage.mjs";
import { analyzeExportSecurityGuards } from "./check-export-security-guards.mjs";
import { analyzePrivacyInventory } from "./check-privacy-inventory.mjs";
import { analyzeRetentionPolicy } from "./check-retention-policy.mjs";
import { analyzeStoragePathSafety } from "./check-storage-path-safety.mjs";
import { analyzeSupabaseRetentionInventory } from "./check-supabase-retention-inventory.mjs";
import { analyzeTokenSecurityQuality } from "./check-token-security-quality.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-privacy-auditability.json";
const ARTIFACT_REL = "artifacts/operational-privacy-auditability.json";
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

function normalizeReport(checkId, report) {
  return {
    checkId,
    ok: Boolean(report.ok ?? report.issueCount === 0),
    issueCount: Number(report.issueCount ?? report.issues?.length ?? report.errors?.length ?? report.violationCount ?? 0),
  };
}

function validateCommands(root, config, packageScripts, ci, securityPipeline, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(`npm run ${script}`);
      const securityPipelinePresent = script.startsWith("check:")
        ? securityPipeline.includes(`"${script}"`)
        : null;
      if (!packageScriptPresent) {
        issues.push(issue("operational_privacy_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_privacy_missing_ci_command", { objective: objective.id, script }));
      }
      if (script.startsWith("check:") && securityPipelinePresent !== true) {
        issues.push(issue("operational_privacy_missing_security_pipeline_step", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        securityPipelinePresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }
    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_privacy_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }
  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function validateMarkerRows(root, rows, prefix, issues) {
  const out = [];
  for (const row of rows ?? []) {
    const text = read(root, row.path);
    const missing = [];
    if (!text) {
      missing.push(...(row.markers ?? []));
      issues.push(issue(`${prefix}_missing_file`, { id: row.id, path: row.path }));
    } else {
      for (const marker of row.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${prefix}_missing_marker`, { id: row.id, path: row.path, marker }));
        }
      }
    }
    out.push({
      id: row.id,
      path: row.path,
      markerCount: row.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("audit-event-coverage", analyzeAuditEventCoverage(root)),
    normalizeReport("export-security-guards", analyzeExportSecurityGuards(root)),
    normalizeReport("privacy-inventory", analyzePrivacyInventory(root)),
    normalizeReport("retention-policy", analyzeRetentionPolicy(root)),
    normalizeReport("storage-path-safety", analyzeStoragePathSafety(root)),
    normalizeReport("supabase-retention-inventory", analyzeSupabaseRetentionInventory({ root })),
    normalizeReport("token-security-quality", analyzeTokenSecurityQuality(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_privacy_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalPrivacyAuditabilityReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-privacy-auditability") {
    issues.push(issue("operational_privacy_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, securityPipeline, issues);
  const privacyInventoryContracts = validateMarkerRows(root, config.privacyInventoryContracts, "operational_privacy_inventory", issues);
  const dsarContracts = validateMarkerRows(root, config.dsarContracts, "operational_privacy_dsar", issues);
  const deletionRetentionContracts = validateMarkerRows(root, config.deletionRetentionContracts, "operational_privacy_lifecycle", issues);
  const auditContracts = validateMarkerRows(root, config.auditContracts, "operational_privacy_audit", issues);
  const hashChainContracts = validateMarkerRows(root, config.hashChainContracts, "operational_privacy_hash_chain", issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-privacy-auditability",
    generatedBy: "scripts/check-operational-privacy-auditability.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    privacyInventoryContractCount: privacyInventoryContracts.length,
    dsarContractCount: dsarContracts.length,
    deletionRetentionContractCount: deletionRetentionContracts.length,
    auditContractCount: auditContracts.length,
    hashChainContractCount: hashChainContracts.length,
    delegatedCheckCount: checks.length,
    commands,
    privacyInventoryContracts,
    dsarContracts,
    deletionRetentionContracts,
    auditContracts,
    hashChainContracts,
    checks,
    manualBoundary: config.manualBoundary,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalPrivacyAuditability(root = ROOT) {
  const report = buildOperationalPrivacyAuditabilityReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_privacy_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_privacy_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-privacy-auditability",
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
    const report = buildOperationalPrivacyAuditabilityReport();
    fs.mkdirSync(path.dirname(path.join(ROOT, ARTIFACT_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ARTIFACT_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const report = analyzeOperationalPrivacyAuditability();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
