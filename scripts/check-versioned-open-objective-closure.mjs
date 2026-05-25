#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";
import { buildVersionedDetailedObjectiveCoverage } from "./check-versioned-detailed-objective-coverage.mjs";
import { buildVersionedLocalSurfaceRegression } from "./check-versioned-local-surface-regression.mjs";
import { buildVersionedManualSurfaceClosure } from "./check-versioned-manual-surface-closure.mjs";
import { buildVersionedPackageScriptReadiness } from "./check-versioned-package-script-readiness.mjs";
import { buildVersionedPublicRuntimeDualRead } from "./check-versioned-public-runtime-dual-read.mjs";
import { buildVersionedRemainingSurfaceCoverage } from "./check-versioned-remaining-surface-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-open-objective-closure.json";

export const OPEN_OBJECTIVE_TAXONOMY = [
  {
    id: "package_script_alias_retirement_readiness",
    owner: "platform-hardening",
    reason: "Retained legacy package scripts need proof that repo-local references are neutralized before any manual removal decision.",
    detailedObjectiveIds: ["package_metadata_module_resolution"],
    queueNames: ["packageScriptAliases"],
    retainedLegacyBlocked: true,
    validationCommand: "npm run check:versioned-package-script-readiness",
    manualFollowUp: "Keep legacy package-script aliases callable until external runbooks and branch protection no longer require them.",
  },
  {
    id: "compatibility_alias_equivalence",
    owner: "platform-hardening",
    reason: "Old and neutral aliases must remain equivalent while legacy names are retained.",
    queueNames: ["packageScriptAliases", "exportedSymbolAliases", "telemetryEventNames", "environmentKeys", "apiRoutes", "cronRoutes", "sqlObjects"],
    validationCommand: "npm run check:versioned-compatibility-equivalence",
    manualFollowUp: "Remove aliases only after their queue rows become ready_for_removal.",
  },
  {
    id: "local_surface_regression_guard",
    owner: "platform-hardening",
    reason: "Remaining local-only surfaces must fail new unclassified product-version labels.",
    localSurfaceGroupIds: [
      "test_tags_skip_and_snapshot_prefixes",
      "fixtures_evidence_and_qa_registries",
      "dom_and_test_selectors",
      "style_tokens_and_visual_keys",
      "copy_and_localization_keys",
      "source_config_and_static_analysis_ids",
    ],
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Queue or allowlist any retained local labels before accepting new version-token hits.",
  },
  {
    id: "content_surface_classification",
    owner: "platform-hardening",
    reason: "Content-level version names must have surface/sub-surface metadata, ownership, neutral-name strategy, and validation evidence.",
    detailedObjectiveIds: [
      "supply_chain_evidence",
      "deployment_runtime_config",
      "auth_capability_entitlement",
      "source_owned_config_static_analysis",
      "static_text_fixtures_snapshots",
      "dom_selector_accessibility",
      "style_tokens_theme_contracts",
      "localization_copy_catalogs",
      "seed_config_scanner_ids",
    ],
    validationCommand: "npm run check:versioned-detailed-objective-coverage",
    manualFollowUp: "Do not remove compatibility-sensitive content names without queue readiness.",
  },
  {
    id: "public_route_and_metadata_preservation",
    owner: "frontend-platform",
    reason: "Public routes, PWA metadata, OpenAPI names, and crawler-visible identifiers need compatibility queues or manual cutover.",
    detailedObjectiveIds: ["public_metadata_pwa_well_known"],
    manualFamilyIds: ["docs_external_pwa_contracts", "public_token_callback_contracts"],
    queueNames: ["apiRoutes", "cronRoutes", "contentContractAliases"],
    runtimeReadiness: true,
    validationCommand: "npm run check:versioned-public-runtime-dual-read",
    manualFollowUp: "Keep public legacy names until runtime aliases are present and consumer cutover evidence exists.",
  },
  {
    id: "telemetry_and_observability_preservation",
    owner: "platform",
    reason: "Persisted telemetry, metrics, audit, and observability names need dashboard and consumer cutover evidence.",
    manualFamilyIds: ["telemetry_event_contracts", "observability_metric_contracts", "audit_evidence_contracts"],
    queueNames: ["telemetryEventNames", "contentContractAliases"],
    requiresProductionOrExternalCutover: true,
    validationCommand: "npm run check:telemetry-event-inventory",
    manualFollowUp: "Keep persisted telemetry names until analytics/dashboard cutover evidence exists.",
  },
  {
    id: "sql_security_and_seed_staging",
    owner: "database-platform",
    reason: "SQL objects, RLS/security references, migrations, and seed keys require forward aliases and linked verification before removal.",
    detailedObjectiveIds: ["sql_security_staging"],
    manualFamilyIds: ["sql_security_contracts", "seed_fixture_contracts"],
    queueNames: ["sqlObjects", "sqlSecurityAutomation", "migrationHistoryFilenames", "seedVersionedNames"],
    requiresProductionOrExternalCutover: true,
    validationCommand: "npm run check:sql-object-rename-staging",
    manualFollowUp: "Do not remove SQL legacy objects or migration evidence without production catalog verification.",
  },
  {
    id: "export_download_storage_contracts",
    owner: "reports-platform",
    reason: "Export/download filenames, storage keys, signed links, and import/export diagnostics need inventory and queue coverage.",
    manualFamilyIds: ["storage_export_contracts"],
    queueNames: ["exportDownloadContracts", "contentContractAliases"],
    validationCommand: "npm run check:versioned-export-download-contracts",
    manualFollowUp: "Keep legacy export/storage names until consumers and signed-link readers migrate.",
  },
  {
    id: "standards_and_provider_version_preservation",
    owner: "platform-security",
    reason: "Standards, provider protocols, signatures, runtime versions, and schemaVersion fields are legitimate versions, not product-version debt.",
    detailedObjectiveIds: ["standards_reference_preservation", "billing_provider_contracts"],
    manualFamilyIds: ["browser_security_policy_contracts"],
    validationCommand: "npm run check:version-reference-allowlist",
    manualFollowUp: "Do not rewrite standards, provider, cryptographic, or artifact schema versions.",
  },
  {
    id: "final_zero_version_enforcement",
    owner: "platform-hardening",
    reason: "Final zero-version enforcement is blocked by retained public/runtime compatibility names and production cutover evidence.",
    queueNames: [
      "packageScriptAliases",
      "telemetryEventNames",
      "apiRoutes",
      "cronRoutes",
      "environmentKeys",
      "sqlObjects",
      "contentContractAliases",
    ],
    requiresProductionOrExternalCutover: true,
    validationCommand: "npm run check:versioned-naming",
    manualFollowUp: "Keep final zero-version enforcement unchecked until all retained queues are ready_for_removal.",
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

function rowsById(rows) {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

function queueRows(queueArtifact, queueName) {
  const rows = queueArtifact?.queues?.[queueName];
  return Array.isArray(rows) ? rows : [];
}

function summarizeObjective(objective, sources) {
  const detailedById = rowsById(sources.detailed.objectives);
  const manualById = rowsById(sources.manual.families);
  const localById = rowsById(sources.localSurface.groups);
  const detailedRows = (objective.detailedObjectiveIds ?? []).map((id) => detailedById.get(id)).filter(Boolean);
  const manualRows = (objective.manualFamilyIds ?? []).map((id) => manualById.get(id)).filter(Boolean);
  const localRows = (objective.localSurfaceGroupIds ?? []).map((id) => localById.get(id)).filter(Boolean);
  const rows = [...detailedRows, ...manualRows, ...localRows];
  const queueCounts = {};
  const queueStatusCounts = {};
  for (const queueName of objective.queueNames ?? []) {
    const rowsForQueue = queueRows(sources.queueArtifact, queueName);
    queueCounts[queueName] = rowsForQueue.length;
    for (const row of rowsForQueue) {
      const status = row.status ?? "missing";
      queueStatusCounts[status] = (queueStatusCounts[status] ?? 0) + 1;
    }
  }

  const uncoveredManualCount = rows.reduce((sum, row) => sum + Number(row.uncoveredManualCount ?? 0), 0);
  const remainingSafeActionCount = rows.reduce((sum, row) => sum + Number(row.remainingSafeActionCount ?? 0), 0);
  const missingMetadataCount = rows.reduce((sum, row) => sum + Number(row.missingMetadataCount ?? 0), 0);
  const missingValidationCommandCount = rows.reduce((sum, row) => sum + Number(row.missingValidationCommandCount ?? 0), 0);
  const runtimeReadiness = objective.runtimeReadiness ? sources.publicRuntimeReadiness : null;
  const runtimeReadinessIssueCount = Number(runtimeReadiness?.issueCount ?? 0);
  const runtimeReadinessSafeActionCount = Number(
    runtimeReadiness?.totals?.remainingSafeActionCount ?? runtimeReadiness?.remainingSafeActionCount ?? 0,
  );
  const currentScannerRowCount = rows.reduce((sum, row) => sum + Number(row.contractCount ?? row.categoryCount ?? 0), 0);
  const gapCount =
    uncoveredManualCount +
    remainingSafeActionCount +
    missingMetadataCount +
    missingValidationCommandCount +
    runtimeReadinessIssueCount +
    runtimeReadinessSafeActionCount;
  const coverageStatus = gapCount > 0
    ? "coverage_gap"
    : objective.requiresProductionOrExternalCutover
      ? "requires_production_or_external_cutover"
      : objective.requiresRuntimeAlias
        ? "requires_runtime_alias"
        : objective.retainedLegacyBlocked
          ? "retained_legacy_blocked"
          : "coverage_proven";

  return {
    id: objective.id,
    owner: objective.owner,
    reason: objective.reason,
    validationCommand: objective.validationCommand,
    manualFollowUp: objective.manualFollowUp,
    coverageStatus,
    detailedObjectiveIds: objective.detailedObjectiveIds ?? [],
    manualFamilyIds: objective.manualFamilyIds ?? [],
    localSurfaceGroupIds: objective.localSurfaceGroupIds ?? [],
    queueNames: objective.queueNames ?? [],
    queueCounts: sortedObject(queueCounts),
    queueStatusCounts: sortedObject(queueStatusCounts),
    currentScannerRowCount,
    uncoveredManualCount,
    remainingSafeActionCount,
    missingMetadataCount,
    missingValidationCommandCount,
    runtimeReadinessStatusCounts: runtimeReadiness?.totals?.statusCounts ?? runtimeReadiness?.statusCounts ?? {},
    runtimeReadinessIssueCount,
    requiresRuntimeAlias: Boolean(objective.requiresRuntimeAlias),
    runtimeReadiness: Boolean(objective.runtimeReadiness),
    requiresProductionOrExternalCutover: Boolean(objective.requiresProductionOrExternalCutover),
    retainedLegacyBlocked: Boolean(objective.retainedLegacyBlocked),
  };
}

function validateObjective(objective) {
  const issues = [];
  for (const key of ["owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof objective[key] !== "string" || objective[key].trim() === "") {
      issues.push({ issue: "versioned_open_objective_missing_metadata", objective: objective.id, key });
    }
  }
  if (objective.uncoveredManualCount > 0) {
    issues.push({ issue: "versioned_open_objective_uncovered_manual_rows", objective: objective.id, count: objective.uncoveredManualCount });
  }
  if (objective.remainingSafeActionCount > 0) {
    issues.push({ issue: "versioned_open_objective_pending_safe_actions", objective: objective.id, count: objective.remainingSafeActionCount });
  }
  if (objective.missingMetadataCount > 0) {
    issues.push({ issue: "versioned_open_objective_missing_row_metadata", objective: objective.id, count: objective.missingMetadataCount });
  }
  if (objective.missingValidationCommandCount > 0) {
    issues.push({ issue: "versioned_open_objective_missing_validation_commands", objective: objective.id, count: objective.missingValidationCommandCount });
  }
  return issues;
}

export function buildVersionedOpenObjectiveClosure(root = DEFAULT_ROOT, options = {}) {
  const sources = {
    detailed: options.detailed ?? buildVersionedDetailedObjectiveCoverage(root, options),
    manual: options.manual ?? buildVersionedManualSurfaceClosure(root, options),
    localSurface: options.localSurface ?? buildVersionedLocalSurfaceRegression(root, options),
    remaining: options.remaining ?? buildVersionedRemainingSurfaceCoverage(root, options),
    contentSurface: options.contentSurface ?? buildVersionedContentSurfaceCoverage(root, options),
    packageReadiness: options.packageReadiness ?? buildVersionedPackageScriptReadiness(root),
    publicRuntimeReadiness: options.publicRuntimeReadiness ?? buildVersionedPublicRuntimeDualRead(root, options),
    queueArtifact: options.queueArtifact ?? buildCompatibilityRemovalQueue(root),
  };
  const objectives = OPEN_OBJECTIVE_TAXONOMY.map((objective) => summarizeObjective(objective, sources)).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const issues = [
    ...(sources.detailed.issues ?? []),
    ...(sources.manual.issues ?? []),
    ...(sources.localSurface.issues ?? []),
    ...(sources.remaining.issues ?? []),
    ...(sources.contentSurface.issues ?? []),
    ...(sources.publicRuntimeReadiness.issues ?? []),
  ];
  for (const objective of objectives) issues.push(...validateObjective(objective));
  const statusCounts = {};
  for (const objective of objectives) {
    statusCounts[objective.coverageStatus] = (statusCounts[objective.coverageStatus] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-open-objective-closure.mjs --write",
    policy:
      "Close code-only version-name objectives using code-owned taxonomy and deterministic inventories. Checklist docs are not configuration.",
    sourceArtifacts: {
      versionedDetailedObjectiveCoverage: "artifacts/compatibility/versioned-detailed-objective-coverage.json",
      versionedManualSurfaceClosure: "artifacts/compatibility/versioned-manual-surface-closure.json",
      versionedLocalSurfaceRegression: "artifacts/compatibility/versioned-local-surface-regression.json",
      versionedRemainingSurfaceCoverage: "artifacts/compatibility/versioned-remaining-surface-coverage.json",
      versionedContentSurfaceCoverage: "artifacts/compatibility/versioned-content-surface-coverage.json",
      versionedPackageScriptReadiness: "artifacts/compatibility/versioned-package-script-readiness.json",
      versionedPublicRuntimeDualRead: "artifacts/compatibility/versioned-public-runtime-dual-read.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
    },
    packageScriptReadiness: {
      aliasCount: sources.packageReadiness.aliasCount,
      readyForRemovalCount: sources.packageReadiness.readyForRemovalCount,
      localReadyForRemovalCount: sources.packageReadiness.localReadyForRemovalCount,
      blockedAliasCount: sources.packageReadiness.blockedAliasCount,
    },
    totals: {
      objectiveCount: objectives.length,
      statusCounts: sortedObject(statusCounts),
      coverageProvenCount: objectives.filter((row) => row.coverageStatus === "coverage_proven").length,
      retainedLegacyBlockedCount: objectives.filter((row) => row.coverageStatus === "retained_legacy_blocked").length,
      requiresRuntimeAliasCount: objectives.filter((row) => row.coverageStatus === "requires_runtime_alias").length,
      requiresProductionOrExternalCutoverCount: objectives.filter((row) => row.coverageStatus === "requires_production_or_external_cutover").length,
      uncoveredManualCount: objectives.reduce((sum, row) => sum + row.uncoveredManualCount, 0),
      remainingSafeActionCount: objectives.reduce((sum, row) => sum + row.remainingSafeActionCount, 0),
      missingValidationCommandCount: objectives.reduce((sum, row) => sum + row.missingValidationCommandCount, 0),
    },
    objectives,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedOpenObjectiveClosure(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedOpenObjectiveClosure(root, options);
  const issues = [...current.issues];
  const committed = readJson(root, artifactRel, null);
  if (!committed) {
    issues.push({ issue: "versioned_open_objective_closure_missing_artifact", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
    issues.push({ issue: "versioned_open_objective_closure_drift", path: artifactRel, hint: "Run npm run write:versioned-open-objective-closure" });
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    objectiveCount: current.totals.objectiveCount,
    statusCounts: current.totals.statusCounts,
    uncoveredManualCount: current.totals.uncoveredManualCount,
    remainingSafeActionCount: current.totals.remainingSafeActionCount,
    missingValidationCommandCount: current.totals.missingValidationCommandCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedOpenObjectiveClosure(root);
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

export function runVersionedOpenObjectiveClosure(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          objectiveCount: artifact.totals.objectiveCount,
          statusCounts: artifact.totals.statusCounts,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeVersionedOpenObjectiveClosure(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedOpenObjectiveClosure();
}
