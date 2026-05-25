#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";
import { buildVersionedRemainingSurfaceCoverage } from "./check-versioned-remaining-surface-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

const PUBLIC_GROUPS = [
  {
    id: "public_metadata_assets",
    subSurfaceClasses: ["public_metadata_or_asset"],
    categoryIds: ["public_metadata_pwa_install_contracts"],
  },
  {
    id: "pwa_well_known_install",
    subSurfaceClasses: ["pwa_or_well_known_contract"],
    categoryIds: ["public_metadata_pwa_install_contracts"],
  },
  {
    id: "routes_deeplinks_redirects",
    subSurfaceClasses: ["page_route_or_deep_link_contract", "api_route_contract", "cron_route_contract"],
    categoryIds: ["route_deeplink_redirect_contracts"],
  },
  {
    id: "openapi_schema_public_contracts",
    subSurfaceClasses: ["openapi_or_json_schema_contract"],
    categoryIds: ["openapi_json_schema_generated_client_contracts"],
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

export function analyzeVersionedPublicContractPreservation(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const contentCoverage = buildVersionedContentSurfaceCoverage(root, options);
  const remainingCoverage = buildVersionedRemainingSurfaceCoverage(root, options);
  const groups = PUBLIC_GROUPS.map((group) => summarizeGroup(group, contentCoverage, remainingCoverage)).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const issues = [...(contentCoverage.issues ?? []), ...(remainingCoverage.issues ?? [])];
  for (const group of groups) {
    if (group.uncoveredManualCount > 0) {
      issues.push({ issue: "versioned_public_contract_uncovered_manual_rows", group: group.id, count: group.uncoveredManualCount });
    }
    if (group.missingMetadataCount > 0) {
      issues.push({ issue: "versioned_public_contract_missing_metadata", group: group.id, count: group.missingMetadataCount });
    }
    if (group.remainingSafeActionCount > 0) {
      issues.push({ issue: "versioned_public_contract_pending_safe_actions", group: group.id, count: group.remainingSafeActionCount });
    }
    if (group.missingValidationCommandCount > 0) {
      issues.push({ issue: "versioned_public_contract_missing_validation_commands", group: group.id, count: group.missingValidationCommandCount });
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

export function runVersionedPublicContractPreservation(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeVersionedPublicContractPreservation(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedPublicContractPreservation();
}
