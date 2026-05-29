#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeDependencyPolicy } from "./check-dependency-policy.mjs";
import { analyzeGithubWorkflowsSecurity } from "./check-github-workflows-security.mjs";
import { analyzeReleaseArtifactProvenance } from "./check-release-artifact-provenance.mjs";
import { analyzeSbomFormatsVexSarif } from "./check-sbom-formats-vex-sarif.mjs";
import { analyzeSbomIntegrity } from "./check-sbom-integrity.mjs";
import { analyzeSbomDualFormatEvidence } from "./check-sbom-dual-format-evidence.mjs";
import { analyzeSecurityReportChecksums } from "./check-security-report-checksums.mjs";
import { analyzeSemgrepRulepackIntegrity } from "./check-semgrep-rulepack-integrity.mjs";
import { analyzeStaticSecretSafety } from "./check-static-secret-safety.mjs";
import { analyzeSupplyChainDependencyRisk } from "./check-supply-chain-dependency-risk.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-supply-chain-risk.json";
const ARTIFACT_REL = "artifacts/operational-supply-chain-risk.json";
const CI_REL = ".github/workflows/ci.yml";
const WRITE = process.argv.includes("--write");
const SECURITY_PIPELINE_EXEMPT = new Set([
  "check:dependency-confusion-guards",
  "check:git-history-secret-exposure",
  "report:dependency-risk",
  "verify-cosign-artifact",
  "verify-slsa-attestation",
]);

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
      const securityPipelineRequired = script.startsWith("check:") && !SECURITY_PIPELINE_EXEMPT.has(script);
      const securityPipelinePresent = securityPipelineRequired ? securityPipeline.includes(`"${script}"`) : null;
      if (!packageScriptPresent) {
        issues.push(issue("operational_supply_chain_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_supply_chain_missing_ci_command", { objective: objective.id, script }));
      }
      if (securityPipelineRequired && securityPipelinePresent !== true) {
        issues.push(issue("operational_supply_chain_missing_security_pipeline_step", { objective: objective.id, script }));
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
        issues.push(issue("operational_supply_chain_missing_objective_artifact", { objective: objective.id, path: rel }));
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

function validateScannerPolicies(root, policies, waiverRegistry, issues) {
  const waiverIds = new Set((waiverRegistry.waivers ?? []).map((row) => row.id));
  const rows = [];
  for (const policy of policies ?? []) {
    const text = read(root, policy.workflow);
    const missing = [];
    for (const field of ["id", "workflow", "owner", "threshold", "reportOutput", "waiverPolicy"]) {
      if (typeof policy[field] !== "string" || policy[field].trim() === "") {
        issues.push(issue("operational_supply_chain_scanner_policy_missing_field", { id: policy.id, field }));
      }
    }
    if (!text) {
      issues.push(issue("operational_supply_chain_scanner_workflow_missing", { id: policy.id, workflow: policy.workflow }));
      missing.push(...(policy.markers ?? []));
    } else {
      for (const marker of policy.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue("operational_supply_chain_scanner_marker_missing", { id: policy.id, workflow: policy.workflow, marker }));
        }
      }
    }
    const waiverId = String(policy.waiverPolicy ?? "").split("#")[1] ?? null;
    if (waiverId && !waiverIds.has(waiverId)) {
      issues.push(issue("operational_supply_chain_scanner_waiver_missing", { id: policy.id, waiverId }));
    }
    rows.push({
      id: policy.id,
      workflow: policy.workflow,
      owner: policy.owner,
      threshold: policy.threshold,
      reportOutput: policy.reportOutput,
      waiverPolicy: policy.waiverPolicy,
      markerCount: policy.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("dependency-policy", analyzeDependencyPolicy(root)),
    normalizeReport("github-workflows-security", analyzeGithubWorkflowsSecurity(root)),
    normalizeReport("release-artifact-provenance", analyzeReleaseArtifactProvenance(root)),
    normalizeReport("sbom-dual-format-evidence", analyzeSbomDualFormatEvidence(root)),
    normalizeReport("sbom-formats-vex-sarif", analyzeSbomFormatsVexSarif(root)),
    normalizeReport("sbom-integrity", analyzeSbomIntegrity(root)),
    normalizeReport("security-report-checksums", analyzeSecurityReportChecksums(root)),
    normalizeReport("semgrep-rulepack-integrity", analyzeSemgrepRulepackIntegrity({ root, strict: true })),
    normalizeReport("static-secret-safety", analyzeStaticSecretSafety(root)),
    normalizeReport("supply-chain-dependency-risk", analyzeSupplyChainDependencyRisk(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_supply_chain_delegated_check_failed", { checkId: report.checkId, issueCount: report.issueCount }));
    }
  }
  return reports;
}

export function buildOperationalSupplyChainRiskReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  const waiverRegistry = readJson(root, "config/qa-external-waiver-registry.json");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-supply-chain-risk") {
    issues.push(issue("operational_supply_chain_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, securityPipeline, issues);
  const scannerPolicies = validateScannerPolicies(root, config.scannerPolicies, waiverRegistry, issues);
  const sbomContracts = validateMarkerRows(root, config.sbomContracts, "operational_supply_chain_sbom", issues);
  const dependencyPolicyContracts = validateMarkerRows(root, config.dependencyPolicyContracts, "operational_supply_chain_dependency_policy", issues);
  const releaseProvenanceContracts = validateMarkerRows(root, config.releaseProvenanceContracts, "operational_supply_chain_release", issues);
  const secretScanContracts = validateMarkerRows(root, config.secretScanContracts, "operational_supply_chain_secret_scan", issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-supply-chain-risk",
    generatedBy: "scripts/check-operational-supply-chain-risk.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    scannerPolicyCount: scannerPolicies.length,
    sbomContractCount: sbomContracts.length,
    dependencyPolicyContractCount: dependencyPolicyContracts.length,
    releaseProvenanceContractCount: releaseProvenanceContracts.length,
    secretScanContractCount: secretScanContracts.length,
    delegatedCheckCount: checks.length,
    commands,
    scannerPolicies,
    sbomContracts,
    dependencyPolicyContracts,
    releaseProvenanceContracts,
    secretScanContracts,
    checks,
    manualBoundary: config.manualBoundary,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalSupplyChainRisk(root = ROOT) {
  const report = buildOperationalSupplyChainRiskReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_supply_chain_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_supply_chain_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-supply-chain-risk",
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
    const report = buildOperationalSupplyChainRiskReport();
    fs.mkdirSync(path.dirname(path.join(ROOT, ARTIFACT_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ARTIFACT_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const report = analyzeOperationalSupplyChainRisk();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
