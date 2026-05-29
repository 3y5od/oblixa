#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeAiBoundaryContract } from "./check-ai-boundary-contract.mjs";
import { analyzeAiContextRedaction } from "./check-ai-context-redaction.mjs";
import { analyzeAiPromptInjectionGuards } from "./check-ai-prompt-injection-guards.mjs";
import { analyzeCircuitBreakerPolicy } from "./check-circuit-breaker-policy.mjs";
import { analyzeEmailDnsFixtures } from "./check-email-dns-fixtures.mjs";
import { analyzeEmailIdentitySpoofGuards } from "./check-email-identity-spoof-guards.mjs";
import { analyzeIntegrationContractSurface } from "./report-integration-contract-surface.mjs";
import { analyzeProviderIntegrationFixtures } from "./check-provider-integration-fixtures.mjs";
import { analyzeRateLimitDistributionSafety } from "./check-rate-limit-distribution-safety.mjs";
import { analyzeRateLimitKeyCardinality } from "./check-rate-limit-key-cardinality.mjs";
import { analyzeSecretsEnvTokenQuality } from "./check-secrets-env-token-quality.mjs";
import { analyzeTimeoutBudgetGuards } from "./check-timeout-budget-guards.mjs";
import { analyzeTokenSecurityQuality } from "./check-token-security-quality.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-provider-integrations.json";
const ARTIFACT_REL = "artifacts/operational-provider-integrations.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");
const SECURITY_PIPELINE_EXEMPT = new Set(["tools:reencrypt-integration-tokens"]);

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
    issueCount: Number(report.issueCount ?? report.issues?.length ?? report.violationCount ?? 0),
  };
}

function validateCommands(root, config, packageScripts, ci, securityPipeline, issues) {
  const rows = [];
  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(packageScripts[script]);
      const ciPresent = ci.includes(`npm run ${script}`);
      const securityPipelineRequired = script.startsWith("check:") && !SECURITY_PIPELINE_EXEMPT.has(script);
      const securityPipelinePresent = script.startsWith("check:")
        ? securityPipeline.includes(`"${script}"`)
        : null;
      if (!packageScriptPresent) {
        issues.push(issue("operational_provider_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_provider_missing_ci_command", { objective: objective.id, script }));
      }
      if (securityPipelineRequired && securityPipelinePresent !== true) {
        issues.push(issue("operational_provider_missing_security_pipeline_step", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        securityPipelineRequired,
        securityPipelinePresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }
    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_provider_missing_objective_artifact", { objective: objective.id, path: rel }));
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
      issues.push(issue(`${prefix}_missing_file`, { id: row.id, path: row.path }));
      missing.push(...(row.markers ?? []));
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
    normalizeReport("ai-boundary-contract", analyzeAiBoundaryContract(root)),
    normalizeReport("ai-context-redaction", analyzeAiContextRedaction(root)),
    normalizeReport("ai-prompt-injection-guards", analyzeAiPromptInjectionGuards(root)),
    normalizeReport("circuit-breaker-policy", analyzeCircuitBreakerPolicy(root)),
    normalizeReport("email-dns-fixtures", analyzeEmailDnsFixtures(root)),
    normalizeReport("email-identity-spoof-guards", analyzeEmailIdentitySpoofGuards(root)),
    normalizeReport("integration-contract-resilience", analyzeIntegrationContractSurface(root, { strict: true, enforceReplayCompat: true })),
    normalizeReport("provider-integration-fixtures", analyzeProviderIntegrationFixtures(root)),
    normalizeReport("rate-limit-distribution-safety", analyzeRateLimitDistributionSafety(root)),
    normalizeReport("rate-limit-key-cardinality", analyzeRateLimitKeyCardinality(root)),
    normalizeReport("secrets-env-token-quality", analyzeSecretsEnvTokenQuality(root)),
    normalizeReport("timeout-budget-guards", analyzeTimeoutBudgetGuards(root)),
    normalizeReport("token-security-quality", analyzeTokenSecurityQuality(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_provider_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalProviderIntegrationsReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-provider-integrations") {
    issues.push(issue("operational_provider_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, securityPipeline, issues);
  const stripeContracts = validateMarkerRows(root, config.stripeContracts, "operational_provider_stripe", issues);
  const emailContracts = validateMarkerRows(root, config.emailContracts, "operational_provider_email", issues);
  const openAiContracts = validateMarkerRows(root, config.openAiContracts, "operational_provider_openai", issues);
  const redisContracts = validateMarkerRows(root, config.redisContracts, "operational_provider_redis", issues);
  const oauthTokenContracts = validateMarkerRows(root, config.oauthTokenContracts, "operational_provider_oauth_token", issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-provider-integrations",
    generatedBy: "scripts/check-operational-provider-integrations.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    stripeContractCount: stripeContracts.length,
    emailContractCount: emailContracts.length,
    openAiContractCount: openAiContracts.length,
    redisContractCount: redisContracts.length,
    oauthTokenContractCount: oauthTokenContracts.length,
    delegatedCheckCount: checks.length,
    commands,
    stripeContracts,
    emailContracts,
    openAiContracts,
    redisContracts,
    oauthTokenContracts,
    checks,
    manualBoundary: config.manualBoundary,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalProviderIntegrations(root = ROOT) {
  const report = buildOperationalProviderIntegrationsReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_provider_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_provider_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-provider-integrations",
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
    const report = buildOperationalProviderIntegrationsReport();
    fs.mkdirSync(path.dirname(path.join(ROOT, ARTIFACT_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ARTIFACT_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }
  const report = analyzeOperationalProviderIntegrations();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
