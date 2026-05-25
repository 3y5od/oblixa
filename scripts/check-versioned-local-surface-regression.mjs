#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";
import { buildVersionedRemainingSurfaceCoverage } from "./check-versioned-remaining-surface-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-local-surface-regression.json";

export const LOCAL_SURFACE_GROUPS = [
  {
    id: "test_tags_skip_and_snapshot_prefixes",
    owner: "test-platform",
    reason: "Local test metadata can carry product-version labels only when classified, queued, or explicitly manual.",
    subSurfaceClasses: ["e2e_contract", "e2e_test_tag_or_fixture", "test_selector"],
    categoryIds: ["static_text_fixtures_snapshots", "seed_fixture_config_scanner_ids"],
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Keep any retained test-only legacy labels queued until fixtures and snapshots migrate.",
  },
  {
    id: "fixtures_evidence_and_qa_registries",
    owner: "platform-hardening",
    reason: "Fixture, evidence, QA, and local reset keys must stay classified so new product-version labels do not appear silently.",
    subSurfaceClasses: ["tooling_or_local_fixture", "seed_fixture_key", "audit_evidence_or_diagnostic_key"],
    categoryIds: ["seed_fixture_config_scanner_ids", "audit_security_evidence_governance_ids"],
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Queue retained fixture/evidence names until local consumers use neutral keys.",
  },
  {
    id: "dom_and_test_selectors",
    owner: "frontend-platform",
    reason: "DOM/test selector compatibility requires explicit queue coverage before old selector strings are removed.",
    subSurfaceClasses: ["dom_data_attribute", "dom_or_test_selector", "test_selector"],
    categoryIds: ["api_payload_metric_dom_selector_contracts"],
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Retain selector aliases until UI tests, analytics, and support tooling consume neutral selectors.",
  },
  {
    id: "style_tokens_and_visual_keys",
    owner: "design-systems",
    reason: "Style tokens and visual keys are local contracts and must not gain unqueued product-version labels.",
    subSurfaceClasses: ["style_token_or_selector"],
    categoryIds: ["design_token_theme_contracts"],
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Queue retained visual/token names until snapshots and themes migrate.",
  },
  {
    id: "copy_and_localization_keys",
    owner: "frontend-platform",
    reason: "Copy and localization keys can be product-facing and need explicit manual-boundary metadata when retained.",
    subSurfaceClasses: ["localization_or_copy_key", "local_copy_or_historical_document", "local_source_literal"],
    categoryIds: ["localization_copy_catalog_contracts", "static_text_fixtures_snapshots"],
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Queue retained copy keys until all localized catalogs and snapshots use neutral names.",
  },
  {
    id: "source_config_and_static_analysis_ids",
    owner: "platform-security",
    reason: "Source-owned config, Semgrep/static-analysis IDs, and scanner IDs are local governance contracts.",
    subSurfaceClasses: ["source_owned_config_or_scanner_id", "tooling_or_local_fixture", "ci_job_matrix_or_artifact"],
    categoryIds: ["seed_fixture_config_scanner_ids", "deployment_runtime_config"],
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Queue retained scanner/config IDs until all local references use neutral IDs.",
  },
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function sortedObject(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function rowsBySubSurface(contentCoverage) {
  return new Map((contentCoverage.bySubSurface ?? []).map((row) => [row.subSurfaceClass, row]));
}

function rowsByCategory(remainingCoverage) {
  return new Map((remainingCoverage.categories ?? []).map((row) => [row.id, row]));
}

function summarizeGroup(group, contentCoverage, remainingCoverage) {
  const subSurfaceRows = rowsBySubSurface(contentCoverage);
  const categoryRows = rowsByCategory(remainingCoverage);
  const surfaceRows = group.subSurfaceClasses.map((subSurfaceClass) => subSurfaceRows.get(subSurfaceClass)).filter(Boolean);
  const categories = group.categoryIds.map((id) => categoryRows.get(id)).filter(Boolean);
  const rows = surfaceRows.length > 0 ? surfaceRows : categories;
  const ownerCoverage = {};
  const queueStatusCounts = {};

  for (const row of surfaceRows) {
    for (const [owner, count] of Object.entries(row.owners ?? {})) {
      ownerCoverage[owner] = (ownerCoverage[owner] ?? 0) + count;
    }
  }
  for (const category of categories) {
    for (const [status, count] of Object.entries(category.queueStatusCounts ?? {})) {
      queueStatusCounts[status] = (queueStatusCounts[status] ?? 0) + count;
    }
  }

  const contractCount = rows.reduce((sum, row) => sum + Number(row.contractCount ?? 0), 0);
  const hitCount = rows.reduce((sum, row) => sum + Number(row.hitCount ?? 0), 0);
  const manualOnlyContractCount = rows.reduce((sum, row) => sum + Number(row.manualOnlyContractCount ?? 0), 0);
  const uncoveredManualCount = rows.reduce((sum, row) => sum + Number(row.uncoveredManualCount ?? 0), 0);
  const missingMetadataCount = rows.reduce((sum, row) => sum + Number(row.missingMetadataCount ?? 0), 0);
  const remainingSafeActionCount = rows.reduce((sum, row) => sum + Number(row.remainingSafeActionCount ?? 0), 0);
  const validationCommandCoveredCount = rows.reduce((sum, row) => sum + Number(row.validationCommandCoveredCount ?? 0), 0);
  const missingValidationCommandCount = Math.max(0, contractCount - validationCommandCoveredCount);
  const categoryGapCount = categories.filter((row) => row.coverageStatus === "coverage_gap").length;
  const coverageStatus =
    uncoveredManualCount + missingMetadataCount + remainingSafeActionCount + missingValidationCommandCount + categoryGapCount === 0
      ? "regression_guarded"
      : "coverage_gap";

  return {
    id: group.id,
    owner: group.owner,
    reason: group.reason,
    validationCommand: group.validationCommand,
    manualFollowUp: group.manualFollowUp,
    subSurfaceClasses: group.subSurfaceClasses,
    categoryIds: group.categoryIds,
    coverageStatus,
    contractCount,
    hitCount,
    manualOnlyContractCount,
    uncoveredManualCount,
    missingMetadataCount,
    remainingSafeActionCount,
    missingValidationCommandCount,
    queueStatusCounts: sortedObject(queueStatusCounts),
    ownerCoverage: sortedObject(ownerCoverage),
  };
}

function validateGroup(group) {
  const issues = [];
  for (const key of ["owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof group[key] !== "string" || group[key].trim() === "") {
      issues.push({ issue: "versioned_local_surface_regression_missing_metadata", group: group.id, key });
    }
  }
  if (group.uncoveredManualCount > 0) {
    issues.push({ issue: "versioned_local_surface_regression_uncovered_manual_rows", group: group.id, count: group.uncoveredManualCount });
  }
  if (group.remainingSafeActionCount > 0) {
    issues.push({ issue: "versioned_local_surface_regression_pending_safe_actions", group: group.id, count: group.remainingSafeActionCount });
  }
  if (group.missingMetadataCount > 0) {
    issues.push({ issue: "versioned_local_surface_regression_missing_row_metadata", group: group.id, count: group.missingMetadataCount });
  }
  if (group.missingValidationCommandCount > 0) {
    issues.push({
      issue: "versioned_local_surface_regression_missing_validation_commands",
      group: group.id,
      count: group.missingValidationCommandCount,
    });
  }
  return issues;
}

export function buildVersionedLocalSurfaceRegression(root = DEFAULT_ROOT, options = {}) {
  const contentCoverage = options.contentCoverage ?? buildVersionedContentSurfaceCoverage(root, options);
  const remainingCoverage = options.remainingCoverage ?? buildVersionedRemainingSurfaceCoverage(root, options);
  const groups = LOCAL_SURFACE_GROUPS.map((group) => summarizeGroup(group, contentCoverage, remainingCoverage)).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const issues = [...(contentCoverage.issues ?? []), ...(remainingCoverage.issues ?? [])];
  for (const group of groups) issues.push(...validateGroup(group));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-local-surface-regression.mjs --write",
    policy:
      "Guard remaining local-only version-name surfaces with deterministic coverage. Public/runtime contracts stay queued or manual.",
    sourceArtifacts: {
      versionedContentSurfaceCoverage: "artifacts/compatibility/versioned-content-surface-coverage.json",
      versionedRemainingSurfaceCoverage: "artifacts/compatibility/versioned-remaining-surface-coverage.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
      versionReferenceAllowlist: "scripts/version-reference-allowlist.json",
    },
    totals: {
      groupCount: groups.length,
      guardedGroupCount: groups.filter((group) => group.coverageStatus === "regression_guarded").length,
      contractCount: groups.reduce((sum, group) => sum + group.contractCount, 0),
      manualOnlyContractCount: groups.reduce((sum, group) => sum + group.manualOnlyContractCount, 0),
      uncoveredManualCount: groups.reduce((sum, group) => sum + group.uncoveredManualCount, 0),
      remainingSafeActionCount: groups.reduce((sum, group) => sum + group.remainingSafeActionCount, 0),
      missingValidationCommandCount: groups.reduce((sum, group) => sum + group.missingValidationCommandCount, 0),
    },
    groups,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedLocalSurfaceRegression(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedLocalSurfaceRegression(root, options);
  const issues = [...current.issues];
  const committed = readJson(root, artifactRel, null);
  if (!committed) {
    issues.push({ issue: "versioned_local_surface_regression_missing_artifact", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
    issues.push({ issue: "versioned_local_surface_regression_drift", path: artifactRel, hint: "Run npm run write:versioned-local-surface-regression" });
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    groupCount: current.totals.groupCount,
    guardedGroupCount: current.totals.guardedGroupCount,
    uncoveredManualCount: current.totals.uncoveredManualCount,
    remainingSafeActionCount: current.totals.remainingSafeActionCount,
    missingValidationCommandCount: current.totals.missingValidationCommandCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedLocalSurfaceRegression(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? DEFAULT_ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runVersionedLocalSurfaceRegression(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          groupCount: artifact.totals.groupCount,
          guardedGroupCount: artifact.totals.guardedGroupCount,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeVersionedLocalSurfaceRegression(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedLocalSurfaceRegression();
}
