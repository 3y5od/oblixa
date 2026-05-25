#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";
import { buildVersionedRemainingSurfaceCoverage } from "./check-versioned-remaining-surface-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

const SOURCE_CONFIG_GROUPS = [
  {
    id: "source_owned_config_scanner_ids",
    subSurfaceClasses: ["source_owned_config_or_scanner_id", "tooling_or_local_fixture"],
    categoryIds: ["seed_fixture_config_scanner_ids"],
  },
  {
    id: "qa_registry_seed_fixture_ids",
    subSurfaceClasses: ["seed_fixture_key", "e2e_contract", "e2e_test_tag_or_fixture"],
    categoryIds: ["seed_fixture_config_scanner_ids", "static_text_fixtures_snapshots"],
  },
  {
    id: "supply_chain_config_evidence",
    subSurfaceClasses: ["supply_chain_evidence_id", "artifact_schema_version"],
    categoryIds: ["supply_chain_evidence_ids"],
  },
  {
    id: "ci_change_impact_evidence_config",
    subSurfaceClasses: ["ci_contract", "ci_job_matrix_or_artifact"],
    categoryIds: ["deployment_runtime_config", "package_script_alias_readiness"],
  },
  {
    id: "standards_compliance_config",
    subSurfaceClasses: ["standards_compliance_reference"],
    categoryIds: ["standards_reference_preservation", "audit_security_evidence_governance_ids"],
  },
];

function rowBySubSurface(contentCoverage) {
  return new Map((contentCoverage.bySubSurface ?? []).map((row) => [row.subSurfaceClass, row]));
}

function categoryById(remainingCoverage) {
  return new Map((remainingCoverage.categories ?? []).map((row) => [row.id, row]));
}

function summarizeGroup(group, contentCoverage, remainingCoverage) {
  const subSurfaces = rowBySubSurface(contentCoverage);
  const categories = categoryById(remainingCoverage);
  const surfaceRows = group.subSurfaceClasses.map((subSurfaceClass) => subSurfaces.get(subSurfaceClass)).filter(Boolean);
  const categoryRows = group.categoryIds.map((id) => categories.get(id)).filter(Boolean);
  const contractCount = surfaceRows.reduce((sum, row) => sum + (row.contractCount ?? 0), 0);
  const manualOnlyContractCount = surfaceRows.reduce((sum, row) => sum + (row.manualOnlyContractCount ?? 0), 0);
  const uncoveredManualCount = surfaceRows.reduce((sum, row) => sum + (row.uncoveredManualCount ?? 0), 0);
  const missingMetadataCount = surfaceRows.reduce((sum, row) => sum + (row.missingMetadataCount ?? 0), 0);
  const remainingSafeActionCount = surfaceRows.reduce((sum, row) => sum + (row.remainingSafeActionCount ?? 0), 0);
  const validationCommandCoveredCount = surfaceRows.reduce((sum, row) => sum + (row.validationCommandCoveredCount ?? 0), 0);
  const missingValidationCommandCount = Math.max(0, contractCount - validationCommandCoveredCount);
  const categoryGapCount = categoryRows.filter((row) => row.coverageStatus === "coverage_gap").length;
  return {
    id: group.id,
    subSurfaceClasses: group.subSurfaceClasses,
    categoryIds: group.categoryIds,
    contractCount,
    manualOnlyContractCount,
    uncoveredManualCount,
    missingMetadataCount,
    remainingSafeActionCount,
    missingValidationCommandCount,
    queueEntryCount: categoryRows.reduce((sum, row) => sum + (row.queueEntryCount ?? 0), 0),
    allowlistEntryCount: categoryRows.reduce((sum, row) => sum + (row.allowlistEntryCount ?? 0), 0),
    coverageStatus:
      uncoveredManualCount + missingMetadataCount + remainingSafeActionCount + missingValidationCommandCount + categoryGapCount === 0
        ? "preserved"
        : "coverage_gap",
  };
}

export function analyzeVersionedSourceConfigPreservation(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const contentCoverage = buildVersionedContentSurfaceCoverage(root, options);
  const remainingCoverage = buildVersionedRemainingSurfaceCoverage(root, options);
  const groups = SOURCE_CONFIG_GROUPS.map((group) => summarizeGroup(group, contentCoverage, remainingCoverage)).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const issues = [...(contentCoverage.issues ?? []), ...(remainingCoverage.issues ?? [])];
  for (const group of groups) {
    if (group.uncoveredManualCount > 0) {
      issues.push({ issue: "versioned_source_config_uncovered_manual_rows", group: group.id, count: group.uncoveredManualCount });
    }
    if (group.missingMetadataCount > 0) {
      issues.push({ issue: "versioned_source_config_missing_metadata", group: group.id, count: group.missingMetadataCount });
    }
    if (group.remainingSafeActionCount > 0) {
      issues.push({ issue: "versioned_source_config_pending_safe_actions", group: group.id, count: group.remainingSafeActionCount });
    }
    if (group.missingValidationCommandCount > 0) {
      issues.push({ issue: "versioned_source_config_missing_validation_commands", group: group.id, count: group.missingValidationCommandCount });
    }
  }
  return {
    ok: issues.length === 0,
    groupCount: groups.length,
    preservedGroupCount: groups.filter((group) => group.coverageStatus === "preserved").length,
    contractCount: groups.reduce((sum, group) => sum + group.contractCount, 0),
    manualOnlyContractCount: groups.reduce((sum, group) => sum + group.manualOnlyContractCount, 0),
    uncoveredManualCount: groups.reduce((sum, group) => sum + group.uncoveredManualCount, 0),
    remainingSafeActionCount: groups.reduce((sum, group) => sum + group.remainingSafeActionCount, 0),
    groups,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    }
  }
  return options;
}

export function runVersionedSourceConfigPreservation(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeVersionedSourceConfigPreservation(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedSourceConfigPreservation();
}
