#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-data-quality-invariants.json";
const ARTIFACT_REL = "artifacts/operational-data-quality-invariants.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_DOMAIN_INVARIANTS = [
  "contract-ownership",
  "contract-status-transitions",
  "renewal-date-ordering",
  "notice-window-ordering",
  "obligation-lifecycle",
  "evidence-requirements",
  "approval-quorum",
  "exception-state",
  "task-dependencies",
  "report-scope",
  "billing-status",
  "workspace-mode",
  "team-membership",
  "counterparty-data",
  "financial-fields",
];

const REQUIRED_PROPERTY_FAMILIES = [
  "date-arithmetic",
  "dst-boundaries",
  "leap-years",
  "month-end",
  "timezone-conversion",
  "fiscal-boundaries",
  "money-parsing",
  "rounding",
  "integer-overflow",
  "status-transitions",
  "workflow-transitions",
  "pagination",
  "filtering",
  "sorting",
  "deduplication",
  "search-query",
  "csv-escaping",
  "url-state-serialization",
];

const REQUIRED_REPORT_CHECKS = [
  "missing-owners",
  "missing-key-dates",
  "invalid-renewal-windows",
  "orphaned-tasks",
  "orphaned-evidence",
  "dangling-foreign-keys",
  "stale-imports",
  "duplicate-counterparties",
  "inconsistent-billing-metadata",
  "invalid-enum-values",
  "impossible-dates",
  "stale-derived-fields",
  "broken-read-models",
];

const REQUIRED_IMPORT_CASES = [
  "duplicate-files",
  "duplicate-contracts",
  "inconsistent-counterparty-names",
  "bad-dates",
  "missing-required-fields",
  "invalid-encodings",
  "partial-import-retry",
  "idempotent-normalization",
];

const REQUIRED_READ_MODEL_CASES = [
  "rebuild-idempotency",
  "partial-rebuild",
  "stale-source-data",
  "missing-source-rows",
  "concurrent-rebuild",
  "output-drift",
  "lineage-required",
];

const REQUIRED_CACHE_CASES = [
  "stale-cache-invalidation",
  "read-after-write-lag",
  "sensitive-cache-bypass",
  "concurrent-update-versioning",
  "fallback-reads",
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readText(rel) {
  return fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), "utf8") : "";
}

function readJson(rel, fallback = null) {
  const text = readText(rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(rel, value) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts() {
  return readJson("package.json", { scripts: {} })?.scripts ?? {};
}

function requirePackageScript(scripts, command, issues, fields = {}) {
  if (typeof command !== "string" || !command.trim()) {
    issues.push(issue("operational_data_quality_missing_validation_command", fields));
    return;
  }
  if (!scripts[command]) {
    issues.push(issue("operational_data_quality_unknown_validation_command", { ...fields, command }));
  }
}

function requireString(row, key, issues, fields = {}) {
  if (typeof row?.[key] !== "string" || !row[key].trim()) {
    issues.push(issue("operational_data_quality_missing_required_field", { ...fields, key }));
  }
}

function requireSetCoverage(actual, required, issueCode, issues, fieldName = "id") {
  const actualSet = new Set(Array.isArray(actual) ? actual : []);
  for (const id of required) {
    if (!actualSet.has(id)) issues.push(issue(issueCode, { [fieldName]: id }));
  }
}

function validateConfig(config, scripts) {
  const issues = [];
  if (config?.schemaVersion !== 1 || config?.source !== "code-owned-operational-data-quality-invariants") {
    issues.push(issue("operational_data_quality_invalid_config_metadata"));
  }
  if (config?.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_data_quality_unexpected_generated_artifact", { generatedArtifact: config?.generatedArtifact ?? null }));
  }

  for (const rel of config?.sourceFiles ?? []) {
    if (!fileExists(rel)) issues.push(issue("operational_data_quality_source_file_missing", { path: rel }));
  }

  for (const command of config?.requiredValidationCommands ?? []) {
    requirePackageScript(scripts, command, issues, { source: "requiredValidationCommands" });
  }

  const sourceText = (config?.sourceFiles ?? [])
    .filter((rel) => rel.endsWith(".ts") || rel.endsWith(".tsx"))
    .map(readText)
    .join("\n");

  const invariantIds = new Set((config?.domainInvariants ?? []).map((row) => row.id));
  for (const id of REQUIRED_DOMAIN_INVARIANTS) {
    if (!invariantIds.has(id)) issues.push(issue("operational_data_quality_missing_domain_invariant", { id }));
  }
  for (const row of config?.domainInvariants ?? []) {
    for (const key of ["id", "ownerArea", "severity", "validationCommand", "fixture", "runtimeGuard", "testRef", "remediationHint"]) {
      requireString(row, key, issues, { invariant: row.id ?? "(missing)" });
    }
    if (!["P0", "P1", "P2"].includes(row.severity)) {
      issues.push(issue("operational_data_quality_unknown_invariant_severity", { invariant: row.id ?? "(missing)", severity: row.severity ?? null }));
    }
    requirePackageScript(scripts, row.validationCommand, issues, { invariant: row.id ?? "(missing)" });
    if (row.testRef && !fileExists(row.testRef)) {
      issues.push(issue("operational_data_quality_invariant_test_ref_missing", { invariant: row.id ?? "(missing)", testRef: row.testRef }));
    }
    if (row.runtimeGuard && !sourceText.includes(row.runtimeGuard)) {
      issues.push(issue("operational_data_quality_runtime_guard_missing", { invariant: row.id ?? "(missing)", runtimeGuard: row.runtimeGuard }));
    }
    if ((row.severity === "P0" || row.severity === "P1") && (!row.testRef || !row.validationCommand || !row.runtimeGuard)) {
      issues.push(issue("operational_data_quality_p0_p1_missing_code_evidence", { invariant: row.id ?? "(missing)" }));
    }
  }

  requireSetCoverage(config?.propertyTestFamilies, REQUIRED_PROPERTY_FAMILIES, "operational_data_quality_missing_property_family", issues, "family");
  requireSetCoverage(config?.dataQualityReportChecks, REQUIRED_REPORT_CHECKS, "operational_data_quality_missing_report_check", issues, "check");
  requireSetCoverage(config?.importReconciliationCases, REQUIRED_IMPORT_CASES, "operational_data_quality_missing_import_case", issues, "caseId");
  requireSetCoverage(config?.readModelSafetyCases, REQUIRED_READ_MODEL_CASES, "operational_data_quality_missing_read_model_case", issues, "caseId");
  requireSetCoverage(config?.cacheSafetyCases, REQUIRED_CACHE_CASES, "operational_data_quality_missing_cache_case", issues, "caseId");

  const testSource = readText("src/lib/operational-data-quality-invariants.test.ts");
  for (const marker of [
    "validateDomainRecord",
    "canTransitionContractStatus",
    "buildDataQualityReport",
    "buildImportReconciliationReport",
    "evaluateReadModelSafety",
    "resolveCacheInvalidationDecision",
    "fc.assert",
  ]) {
    if (!testSource.includes(marker)) {
      issues.push(issue("operational_data_quality_test_marker_missing", { marker }));
    }
  }

  return issues;
}

export function buildOperationalDataQualityInvariantsReport() {
  const config = readJson(CONFIG_REL, {});
  const scripts = packageScripts();
  const issues = validateConfig(config, scripts);
  const p0p1Invariants = (config.domainInvariants ?? []).filter((row) => row.severity === "P0" || row.severity === "P1");

  return {
    schemaVersion: 1,
    source: "code-owned-operational-data-quality-invariants",
    generatedArtifact: ARTIFACT_REL,
    ok: issues.length === 0,
    summary: {
      domainInvariantCount: config.domainInvariants?.length ?? 0,
      p0p1InvariantCount: p0p1Invariants.length,
      propertyTestFamilyCount: config.propertyTestFamilies?.length ?? 0,
      dataQualityReportCheckCount: config.dataQualityReportChecks?.length ?? 0,
      importReconciliationCaseCount: config.importReconciliationCases?.length ?? 0,
      readModelSafetyCaseCount: config.readModelSafetyCases?.length ?? 0,
      cacheSafetyCaseCount: config.cacheSafetyCases?.length ?? 0,
    },
    requiredValidationCommands: config.requiredValidationCommands ?? [],
    domainInvariants: config.domainInvariants ?? [],
    propertyTestFamilies: config.propertyTestFamilies ?? [],
    dataQualityReportChecks: config.dataQualityReportChecks ?? [],
    importReconciliationCases: config.importReconciliationCases ?? [],
    readModelSafetyCases: config.readModelSafetyCases ?? [],
    cacheSafetyCases: config.cacheSafetyCases ?? [],
    p0p1Coverage: p0p1Invariants.map((row) => ({
      id: row.id,
      validationCommand: row.validationCommand,
      testRef: row.testRef,
      runtimeGuard: row.runtimeGuard,
      remediationHint: row.remediationHint,
    })),
    issueCount: issues.length,
    issues,
  };
}

const report = buildOperationalDataQualityInvariantsReport();

if (WRITE) {
  writeJson(ARTIFACT_REL, report);
} else {
  const existing = readJson(ARTIFACT_REL, null);
  if (!existing) {
    report.issues.push(issue("operational_data_quality_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
    report.ok = false;
  } else if (stableStringify(existing) !== stableStringify(report)) {
    report.issues.push(issue("operational_data_quality_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-data-quality-invariants" }));
    report.issueCount = report.issues.length;
    report.ok = false;
  }
}

console.log(stableStringify(report));

if (!report.ok) {
  process.exitCode = 1;
}
