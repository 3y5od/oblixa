#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeAiBoundaryContract } from "./check-ai-boundary-contract.mjs";
import { analyzeAiContextRedaction } from "./check-ai-context-redaction.mjs";
import { analyzeAiPromptInjectionGuards } from "./check-ai-prompt-injection-guards.mjs";
import { analyzeAiToolCallAuthz } from "./check-ai-tool-call-authz.mjs";
import { analyzeBinaryMetadataStripping } from "./check-binary-metadata-stripping.mjs";
import { analyzeConcurrencyCapGuards } from "./check-concurrency-cap-guards.mjs";
import { analyzeDecompressionBombGuards } from "./check-decompression-bomb-guards.mjs";
import { analyzeExportSecurityGuards } from "./check-export-security-guards.mjs";
import { analyzeParserRiskControls } from "./check-parser-risk-controls.mjs";
import { analyzePathTraversalGuards } from "./check-path-traversal-guards.mjs";
import { analyzeRegexDosRisk } from "./check-regex-dos-risk.mjs";
import { analyzeResponseSizeGuards } from "./check-response-size-guards.mjs";
import { analyzeSensitiveCacheControls } from "./check-sensitive-cache-controls.mjs";
import { analyzeSignedLinkNoncePolicy } from "./check-signed-link-nonce-policy.mjs";
import { analyzeSignedLinkScopeNarrowing } from "./check-signed-link-scope-narrowing.mjs";
import { analyzeStoragePathSafety } from "./check-storage-path-safety.mjs";
import { analyzeTimeoutBudgetGuards } from "./check-timeout-budget-guards.mjs";
import { analyzeUploadBanlist } from "./check-upload-banlist.mjs";
import { analyzeUploadSecurityGuards } from "./check-upload-security-guards.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-uploads-files-extraction.json";
const ARTIFACT_REL = "artifacts/operational-uploads-files-extraction.json";
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
      const ciPresent = ci.includes(commandText(script));
      const securityPipelinePresent = script.startsWith("check:") ? securityPipeline.includes(`"${script}"`) : null;
      if (!packageScriptPresent) {
        issues.push(issue("operational_uploads_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_uploads_missing_ci_command", { objective: objective.id, script }));
      }
      if (script.startsWith("check:") && securityPipelinePresent !== true) {
        issues.push(issue("operational_uploads_missing_security_pipeline_step", { objective: objective.id, script }));
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
        issues.push(issue("operational_uploads_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }
  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

function validateMarkerRows(root, rows, issuePrefix, issues) {
  const markerRows = [];
  for (const markerFile of rows ?? []) {
    const text = read(root, markerFile.path);
    const missing = [];
    if (!text) {
      missing.push(...(markerFile.markers ?? []));
      issues.push(issue(`${issuePrefix}_missing_marker_file`, { id: markerFile.id, path: markerFile.path }));
    } else {
      for (const marker of markerFile.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { id: markerFile.id, path: markerFile.path, marker }));
        }
      }
    }
    markerRows.push({
      id: markerFile.id,
      path: markerFile.path,
      markerCount: markerFile.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }
  return markerRows.sort((a, b) => a.id.localeCompare(b.id));
}

function delegatedReports(root, issues) {
  const reports = [
    normalizeReport("ai-boundary-contract", analyzeAiBoundaryContract(root)),
    normalizeReport("ai-context-redaction", analyzeAiContextRedaction(root)),
    normalizeReport("ai-prompt-injection-guards", analyzeAiPromptInjectionGuards(root)),
    normalizeReport("ai-tool-call-authz", analyzeAiToolCallAuthz(root)),
    normalizeReport("binary-metadata-stripping", analyzeBinaryMetadataStripping(root)),
    normalizeReport("concurrency-cap-guards", analyzeConcurrencyCapGuards(root)),
    normalizeReport("decompression-bomb-guards", analyzeDecompressionBombGuards(root)),
    normalizeReport("export-security-guards", analyzeExportSecurityGuards(root)),
    normalizeReport("parser-risk-controls", analyzeParserRiskControls(root)),
    normalizeReport("path-traversal-guards", analyzePathTraversalGuards(root)),
    normalizeReport("regex-dos-risk", analyzeRegexDosRisk(root)),
    normalizeReport("response-size-guards", analyzeResponseSizeGuards(root)),
    normalizeReport("sensitive-cache-controls", analyzeSensitiveCacheControls(root)),
    normalizeReport("signed-link-nonce-policy", analyzeSignedLinkNoncePolicy(root)),
    normalizeReport("signed-link-scope-narrowing", analyzeSignedLinkScopeNarrowing(root)),
    normalizeReport("storage-path-safety", analyzeStoragePathSafety(root)),
    normalizeReport("timeout-budget-guards", analyzeTimeoutBudgetGuards(root)),
    normalizeReport("upload-banlist", analyzeUploadBanlist(root)),
    normalizeReport("upload-security-guards", analyzeUploadSecurityGuards(root)),
  ].sort((a, b) => a.checkId.localeCompare(b.checkId));

  for (const report of reports) {
    if (!report.ok) {
      issues.push(issue("operational_uploads_delegated_check_failed", {
        checkId: report.checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  return reports;
}

export function buildOperationalUploadsFilesExtractionReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL);
  const packageScripts = readJson(root, "package.json").scripts ?? {};
  const ci = read(root, CI_REL);
  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-uploads-files-extraction") {
    issues.push(issue("operational_uploads_invalid_config_metadata"));
  }

  const commands = validateCommands(root, config, packageScripts, ci, securityPipeline, issues);
  const uploadValidationContracts = validateMarkerRows(root, config.uploadValidationContracts ?? [], "operational_uploads_validation", issues);
  const parserFaultContracts = validateMarkerRows(root, config.parserFaultContracts ?? [], "operational_uploads_parser", issues);
  const aiExtractionContracts = validateMarkerRows(root, config.aiExtractionContracts ?? [], "operational_uploads_ai", issues);
  const generatedExportContracts = validateMarkerRows(root, config.generatedExportContracts ?? [], "operational_uploads_export", issues);
  const checks = delegatedReports(root, issues);

  return {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-uploads-files-extraction",
    generatedBy: "scripts/check-operational-uploads-files-extraction.mjs --write",
    generatedFrom: CONFIG_REL,
    ciWorkflow: CI_REL,
    commandCount: commands.length,
    uploadValidationContractCount: uploadValidationContracts.length,
    parserFaultContractCount: parserFaultContracts.length,
    aiExtractionContractCount: aiExtractionContracts.length,
    generatedExportContractCount: generatedExportContracts.length,
    delegatedCheckCount: checks.length,
    commands,
    uploadValidationContracts,
    parserFaultContracts,
    aiExtractionContracts,
    generatedExportContracts,
    checks,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export function analyzeOperationalUploadsFilesExtraction(root = ROOT) {
  const report = buildOperationalUploadsFilesExtractionReport(root);
  const artifactPath = path.join(root, ARTIFACT_REL);
  const serialized = stableStringify(report);
  const issues = [...report.issues];
  if (!fs.existsSync(artifactPath)) {
    issues.push(issue("operational_uploads_artifact_missing", { artifact: ARTIFACT_REL }));
  } else if (fs.readFileSync(artifactPath, "utf8") !== serialized) {
    issues.push(issue("operational_uploads_artifact_drift", {
      artifact: ARTIFACT_REL,
      writeCommand: "npm run write:operational-uploads-files-extraction",
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
    const report = buildOperationalUploadsFilesExtractionReport();
    fs.mkdirSync(path.dirname(path.join(ROOT, ARTIFACT_REL)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ARTIFACT_REL), stableStringify(report));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  const report = analyzeOperationalUploadsFilesExtraction();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
