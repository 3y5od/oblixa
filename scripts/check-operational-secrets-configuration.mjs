#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeCiArtifactSecretLeakage } from "./check-ci-artifact-secret-leakage.mjs";
import { analyzeClientBundleSecretLeakage } from "./check-client-bundle-secret-leakage.mjs";
import { analyzeEnvContractHygiene } from "./check-env-contract-hygiene.mjs";
import { analyzeNextPublicSurface } from "./check-next-public-surface.mjs";
import { analyzeSecretsEnvTokenQuality } from "./check-secrets-env-token-quality.mjs";
import { analyzeStaticSecretSafety } from "./check-static-secret-safety.mjs";
import { analyzeTestFixtureSecrets } from "./check-test-fixture-secrets.mjs";
import { analyzeTokenSecurityQuality } from "./check-token-security-quality.mjs";
import { analyzeTrackedSecretsHygiene } from "./check-tracked-secrets-hygiene.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-secrets-configuration.json";
const ARTIFACT_REL = "artifacts/operational-secrets-configuration.json";
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

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function parseEnvExampleKeys(text) {
  const keys = new Set();
  for (const match of text.matchAll(/^\s*#?\s*([A-Z0-9_]+)=/gm)) keys.add(match[1]);
  return keys;
}

function validateCommands(root, config, packageScripts, ci, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_secrets_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_secrets_missing_ci_command", { objective: objective.id, script }));
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
        issues.push(issue("operational_secrets_missing_objective_artifact", { objective: objective.id, path: rel }));
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
      issues.push(issue("operational_secrets_missing_marker_file", { path: markerFile.path }));
      missing.push(...(markerFile.markers ?? []));
    } else {
      for (const marker of collectMissingMarkers(text, markerFile.markers ?? [])) {
        missing.push(marker);
        issues.push(issue("operational_secrets_missing_marker", { path: markerFile.path, marker }));
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

function validateAllowlists(root, config, issues) {
  const rows = [];
  const nowMs = Date.now();
  for (const allowlist of config.allowlists ?? []) {
    const row = {
      path: allowlist.path,
      entryCount: 0,
      requiredEntryFields: [...(allowlist.requiredEntryFields ?? [])].sort((a, b) => a.localeCompare(b)),
      expiredCount: 0,
      missingFieldCount: 0,
      ok: true,
    };
    const text = read(root, allowlist.path);
    if (!text) {
      issues.push(issue("operational_secrets_allowlist_missing", { path: allowlist.path }));
      row.ok = false;
      rows.push(row);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      issues.push(issue("operational_secrets_allowlist_invalid_json", { path: allowlist.path }));
      row.ok = false;
      rows.push(row);
      continue;
    }
    if (parsed.schemaVersion !== allowlist.schemaVersion) {
      issues.push(issue("operational_secrets_allowlist_schema_version_mismatch", { path: allowlist.path }));
    }
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    row.entryCount = entries.length;
    for (const [index, entry] of entries.entries()) {
      for (const field of allowlist.requiredEntryFields ?? []) {
        if (typeof entry?.[field] !== "string" || entry[field].trim() === "") {
          row.missingFieldCount += 1;
          issues.push(issue("operational_secrets_allowlist_entry_missing_field", { path: allowlist.path, index, field }));
        }
      }
      if (typeof entry?.expiresOn === "string") {
        const expiresAtMs = Date.parse(`${entry.expiresOn}T23:59:59.999Z`);
        if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
          row.expiredCount += 1;
          issues.push(issue("operational_secrets_allowlist_entry_expired", { path: allowlist.path, index }));
        }
      }
    }
    row.ok = row.missingFieldCount === 0 && row.expiredCount === 0;
    rows.push(row);
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function validateSecretBoundaries(config, packageScripts, issues) {
  return (config.secretBoundaries ?? [])
    .map((row) => {
      const commandPresent = Boolean(packageScripts[row.command]);
      if (!commandPresent) {
        issues.push(issue("operational_secrets_boundary_command_missing", { id: row.id, command: row.command }));
      }
      return {
        id: row.id,
        surface: row.surface,
        command: row.command,
        commandPresent,
        policy: row.policy,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function validatePublicEnvAllowlist(root, config, issues) {
  const source = read(root, "scripts/check-next-public-surface.mjs");
  return [...(config.publicEnvAllowlist ?? [])]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const presentInScanner = source.includes(`"${key}"`);
      if (!presentInScanner) {
        issues.push(issue("operational_secrets_public_env_not_in_scanner_allowlist", { key }));
      }
      return { key, presentInScanner };
    });
}

function validateRotationContracts(root, config, issues) {
  const envKeys = parseEnvExampleKeys(read(root, ".env.example"));
  return (config.rotationContracts ?? [])
    .map((contract) => {
      const missingEnvKeys = [];
      const missingFiles = [];
      for (const key of contract.envKeys ?? []) {
        if (!envKeys.has(key)) {
          missingEnvKeys.push(key);
          issues.push(issue("operational_secrets_rotation_env_key_missing", { id: contract.id, key }));
        }
      }
      for (const rel of [...(contract.implementationFiles ?? []), ...(contract.testFiles ?? [])]) {
        if (!fs.existsSync(path.join(root, rel))) {
          missingFiles.push(rel);
          issues.push(issue("operational_secrets_rotation_file_missing", { id: contract.id, path: rel }));
        }
      }
      return {
        id: contract.id,
        strategy: contract.strategy,
        envKeys: [...(contract.envKeys ?? [])].sort((a, b) => a.localeCompare(b)),
        missingEnvKeys: missingEnvKeys.sort((a, b) => a.localeCompare(b)),
        implementationFiles: [...(contract.implementationFiles ?? [])].sort((a, b) => a.localeCompare(b)),
        testFiles: [...(contract.testFiles ?? [])].sort((a, b) => a.localeCompare(b)),
        missingFiles: missingFiles.sort((a, b) => a.localeCompare(b)),
        ok: missingEnvKeys.length === 0 && missingFiles.length === 0,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
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
    normalizeReport("static-secret-safety", analyzeStaticSecretSafety(root)),
    normalizeReport("tracked-secrets-hygiene", analyzeTrackedSecretsHygiene(root)),
    normalizeReport("test-fixture-secrets", analyzeTestFixtureSecrets(root)),
    normalizeReport("ci-artifact-secret-leakage", analyzeCiArtifactSecretLeakage(root)),
    normalizeReport("next-public-surface", analyzeNextPublicSurface(root)),
    normalizeReport("client-bundle-secret-leakage", analyzeClientBundleSecretLeakage(root)),
    normalizeReport("env-contract-hygiene", analyzeEnvContractHygiene(root)),
    normalizeReport("secrets-env-token-quality", analyzeSecretsEnvTokenQuality(root)),
    normalizeReport("token-security-quality", analyzeTokenSecurityQuality(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_secrets_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalSecretsConfigurationReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-secrets-configuration") {
    issues.push(issue("operational_secrets_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, issues);
  const markerFiles = validateMarkers(root, config, issues);
  const allowlists = validateAllowlists(root, config, issues);
  const secretBoundaries = validateSecretBoundaries(config, packageScripts, issues);
  const publicEnvAllowlist = validatePublicEnvAllowlist(root, config, issues);
  const rotationContracts = validateRotationContracts(root, config, issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-secrets-configuration",
    generatedBy: "scripts/check-operational-secrets-configuration.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    markerFileCount: markerFiles.length,
    allowlistCount: allowlists.length,
    secretBoundaryCount: secretBoundaries.length,
    publicEnvKeyCount: publicEnvAllowlist.length,
    rotationContractCount: rotationContracts.length,
    delegatedCheckCount: checks.length,
    commands,
    markerFiles,
    allowlists,
    secretBoundaries,
    publicEnvAllowlist,
    rotationContracts,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalSecretsConfiguration(root = ROOT) {
  const report = buildOperationalSecretsConfigurationReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_secrets_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_secrets_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-secrets-configuration",
    }));
  }
  return {
    ...report,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function runOperationalSecretsConfiguration(root = ROOT) {
  const report = buildOperationalSecretsConfigurationReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(report));
    console.log(stableStringify({ ...report, wrote: ARTIFACT_REL }));
    if (!report.ok) process.exitCode = 1;
    return report;
  }
  const checked = analyzeOperationalSecretsConfiguration(root);
  console.log(stableStringify(checked));
  if (!checked.ok) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationalSecretsConfiguration();
}
