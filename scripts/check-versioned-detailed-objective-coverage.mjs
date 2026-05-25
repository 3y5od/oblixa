#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";
import { buildVersionedRemainingSurfaceCoverage } from "./check-versioned-remaining-surface-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-detailed-objective-coverage.json";

const DETAILED_OBJECTIVES = [
  {
    id: "package_metadata_module_resolution",
    label: "Package metadata, module resolution, script aliases, and local command shims",
    categoryIds: ["package_script_alias_readiness"],
    subSurfaceClasses: ["package_script_key", "package_script_or_metadata"],
    retainedLegacySurface: true,
  },
  {
    id: "supply_chain_evidence",
    label: "SBOM, provenance, attestation, license, and supply-chain waiver identifiers",
    categoryIds: ["supply_chain_evidence_ids"],
    subSurfaceClasses: ["supply_chain_evidence_id", "artifact_schema_version"],
  },
  {
    id: "deployment_runtime_config",
    label: "Deployment, runtime, CI, source-map, and platform config identifiers",
    categoryIds: ["deployment_runtime_config"],
    subSurfaceClasses: ["ci_contract", "ci_job_matrix_or_artifact", "environment_key", "operational_env_key", "public_env_key"],
  },
  {
    id: "auth_capability_entitlement",
    label: "Authorization, capability, feature-family, entitlement, and plan-gate identifiers",
    categoryIds: ["auth_capability_entitlement_keys"],
    subSurfaceClasses: ["feature_flag_key", "source_schema_or_action_contract"],
  },
  {
    id: "billing_provider_contracts",
    label: "Billing, subscription, provider catalog, webhook, and invoice/export identifiers",
    categoryIds: ["billing_provider_contract_keys"],
    subSurfaceClasses: [
      "provider_or_protocol_version",
      "provider_signature_version",
      "provider_oauth_protocol_version",
      "webhook_or_provider_callback",
    ],
  },
  {
    id: "public_metadata_pwa_well_known",
    label: "Public metadata, SEO/social metadata, PWA, public asset, sitemap, robots, canonical, and well-known identifiers",
    categoryIds: ["public_metadata_pwa_install_contracts"],
    subSurfaceClasses: ["public_metadata_or_asset", "pwa_or_well_known_contract", "page_route_or_deep_link_contract"],
  },
  {
    id: "source_owned_config_static_analysis",
    label: "Source-owned config, QA registries, static-analysis IDs, scanner packs, and local reset fixtures",
    categoryIds: ["seed_fixture_config_scanner_ids"],
    subSurfaceClasses: ["source_owned_config_or_scanner_id", "tooling_or_local_fixture", "seed_fixture_key"],
  },
  {
    id: "standards_reference_preservation",
    label: "Standards, protocol, provider, runtime, dependency, crypto, and schema version references",
    categoryIds: [
      "browser_security_policy_versions",
      "billing_provider_contract_keys",
      "provider_integration_connector_ids",
      "supply_chain_evidence_ids",
    ],
    subSurfaceClasses: [
      "standards_compliance_reference",
      "artifact_schema_version",
      "cryptographic_envelope_version",
      "provider_signature_version",
      "provider_oauth_protocol_version",
      "provider_or_protocol_version",
      "provider_model_or_eval_version",
    ],
  },
  {
    id: "static_text_fixtures_snapshots",
    label: "Static text, local copy, test descriptions, fixtures, snapshots, visual evidence, and local QA text",
    categoryIds: ["localization_copy_catalog_contracts", "seed_fixture_config_scanner_ids"],
    subSurfaceClasses: [
      "local_copy_or_historical_document",
      "local_source_literal",
      "tooling_or_local_fixture",
      "e2e_contract",
      "e2e_test_tag_or_fixture",
    ],
  },
  {
    id: "dom_selector_accessibility",
    label: "DOM data attributes, selectors, accessibility linkage, test IDs, and local UI automation contracts",
    categoryIds: ["api_payload_metric_dom_selector_contracts"],
    subSurfaceClasses: ["dom_data_attribute", "dom_or_test_selector", "test_selector"],
  },
  {
    id: "style_tokens_theme_contracts",
    label: "Style tokens, CSS custom properties, theme metadata, and visual styling contracts",
    categoryIds: ["design_token_theme_contracts"],
    subSurfaceClasses: ["style_token_or_selector"],
  },
  {
    id: "localization_copy_catalogs",
    label: "Localization keys, copy catalogs, pseudo-locale fixtures, and localized metadata",
    categoryIds: ["localization_copy_catalog_contracts"],
    subSurfaceClasses: ["localization_or_copy_key", "local_copy_or_historical_document"],
  },
  {
    id: "sql_security_staging",
    label: "SQL object, RLS helper, policy, trigger, grant, realtime, seed, and migration-staging identifiers",
    categoryIds: ["domain_workflow_policy_state_contracts"],
    subSurfaceClasses: ["sql_or_persisted_key", "migration_sql_content", "seed_fixture_key"],
  },
  {
    id: "seed_config_scanner_ids",
    label: "Supabase seed rows, local reset fixtures, source-owned allowlists, and scanner/config IDs",
    categoryIds: ["seed_fixture_config_scanner_ids"],
    subSurfaceClasses: ["seed_fixture_key", "source_owned_config_or_scanner_id", "tooling_or_local_fixture"],
  },
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sortedObjectFromCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function subSurfaceRowsForObjective(contentCoverage, objective) {
  const bySubSurface = new Map((contentCoverage.bySubSurface ?? []).map((row) => [row.subSurfaceClass, row]));
  return (objective.subSurfaceClasses ?? [])
    .map((subSurfaceClass) => bySubSurface.get(subSurfaceClass) ?? {
      subSurfaceClass,
      surfaceClasses: [],
      owners: {},
      contractCount: 0,
      hitCount: 0,
      manualOnlyContractCount: 0,
      queueCoveredManualCount: 0,
      allowlistCoveredManualCount: 0,
      documentationOnlyManualCount: 0,
      uncoveredManualCount: 0,
      missingMetadataCount: 0,
      validationCommandCoveredCount: 0,
      remainingSafeActionCount: 0,
    })
    .sort((a, b) => a.subSurfaceClass.localeCompare(b.subSurfaceClass));
}

function categoriesForObjective(remainingCoverage, objective) {
  const wanted = new Set(objective.categoryIds ?? []);
  return (remainingCoverage.categories ?? [])
    .filter((category) => wanted.has(category.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function summarizeObjective(objective, remainingCoverage, contentCoverage) {
  const categories = categoriesForObjective(remainingCoverage, objective);
  const subSurfaces = subSurfaceRowsForObjective(contentCoverage, objective);
  const ownerCounts = {};
  const queueStatusCounts = {};

  for (const row of subSurfaces) {
    for (const [owner, count] of Object.entries(row.owners ?? {})) {
      ownerCounts[owner] = (ownerCounts[owner] ?? 0) + count;
    }
  }
  for (const category of categories) {
    for (const [status, count] of Object.entries(category.queueStatusCounts ?? {})) {
      queueStatusCounts[status] = (queueStatusCounts[status] ?? 0) + count;
    }
  }

  const contractCount = subSurfaces.reduce((sum, row) => sum + (row.contractCount ?? 0), 0);
  const hitCount = subSurfaces.reduce((sum, row) => sum + (row.hitCount ?? 0), 0);
  const manualOnlyContractCount = subSurfaces.reduce((sum, row) => sum + (row.manualOnlyContractCount ?? 0), 0);
  const queueCoveredManualCount = subSurfaces.reduce((sum, row) => sum + (row.queueCoveredManualCount ?? 0), 0);
  const allowlistCoveredManualCount = subSurfaces.reduce((sum, row) => sum + (row.allowlistCoveredManualCount ?? 0), 0);
  const documentationOnlyManualCount = subSurfaces.reduce((sum, row) => sum + (row.documentationOnlyManualCount ?? 0), 0);
  const uncoveredManualCount = subSurfaces.reduce((sum, row) => sum + (row.uncoveredManualCount ?? 0), 0);
  const missingMetadataCount = subSurfaces.reduce((sum, row) => sum + (row.missingMetadataCount ?? 0), 0);
  const remainingSafeActionCount = subSurfaces.reduce((sum, row) => sum + (row.remainingSafeActionCount ?? 0), 0);
  const validationCommandCoveredCount = subSurfaces.reduce((sum, row) => sum + (row.validationCommandCoveredCount ?? 0), 0);
  const missingValidationCommandCount = Math.max(0, contractCount - validationCommandCoveredCount);
  const categoryGapCount = categories.filter((category) => category.coverageStatus === "coverage_gap").length;
  const retainedLegacySurface = Boolean(objective.retainedLegacySurface);
  const issueCount =
    uncoveredManualCount +
    missingMetadataCount +
    remainingSafeActionCount +
    missingValidationCommandCount +
    categoryGapCount;
  const coverageStatus = retainedLegacySurface
    ? "legacy_alias_retained"
    : issueCount === 0
      ? contractCount === 0 && categories.length === 0
        ? "no_current_hits"
        : "coverage_proven"
      : "coverage_gap";

  return {
    id: objective.id,
    label: objective.label,
    retainedLegacySurface,
    coverageStatus,
    categoryIds: categories.map((category) => category.id),
    subSurfaceClasses: subSurfaces.map((row) => row.subSurfaceClass),
    contractCount,
    hitCount,
    manualOnlyContractCount,
    queueCoveredManualCount,
    allowlistCoveredManualCount,
    documentationOnlyManualCount,
    uncoveredManualCount,
    missingMetadataCount,
    validationCommandCoveredCount,
    missingValidationCommandCount,
    remainingSafeActionCount,
    queueEntryCount: categories.reduce((sum, category) => sum + (category.queueEntryCount ?? 0), 0),
    queueStatusCounts: sortedObjectFromCounts(queueStatusCounts),
    allowlistEntryCount: categories.reduce((sum, category) => sum + (category.allowlistEntryCount ?? 0), 0),
    ownerCoverage: sortedObjectFromCounts(ownerCounts),
  };
}

function validateObjective(objective) {
  const issues = [];
  if (!objective.retainedLegacySurface && objective.uncoveredManualCount > 0) {
    issues.push({ issue: "versioned_detailed_objective_uncovered_manual_rows", objective: objective.id, count: objective.uncoveredManualCount });
  }
  if (objective.missingMetadataCount > 0) {
    issues.push({ issue: "versioned_detailed_objective_missing_metadata", objective: objective.id, count: objective.missingMetadataCount });
  }
  if (!objective.retainedLegacySurface && objective.remainingSafeActionCount > 0) {
    issues.push({ issue: "versioned_detailed_objective_has_pending_safe_actions", objective: objective.id, count: objective.remainingSafeActionCount });
  }
  if (objective.missingValidationCommandCount > 0) {
    issues.push({ issue: "versioned_detailed_objective_missing_validation_commands", objective: objective.id, count: objective.missingValidationCommandCount });
  }
  if (!objective.retainedLegacySurface && objective.coverageStatus === "coverage_gap") {
    issues.push({ issue: "versioned_detailed_objective_coverage_gap", objective: objective.id });
  }
  return issues;
}

export function buildVersionedDetailedObjectiveCoverage(root = DEFAULT_ROOT, options = {}) {
  const remainingCoverage = buildVersionedRemainingSurfaceCoverage(root, options);
  const contentCoverage = buildVersionedContentSurfaceCoverage(root, options);
  const objectives = DETAILED_OBJECTIVES.map((objective) => summarizeObjective(objective, remainingCoverage, contentCoverage))
    .sort((a, b) => a.id.localeCompare(b.id));
  const issues = [...(remainingCoverage.issues ?? []), ...(contentCoverage.issues ?? [])];
  for (const objective of objectives) issues.push(...validateObjective(objective));

  const totals = {
    objectiveCount: objectives.length,
    coverageProvenObjectiveCount: objectives.filter((row) => row.coverageStatus === "coverage_proven").length,
    retainedLegacyObjectiveCount: objectives.filter((row) => row.retainedLegacySurface).length,
    noCurrentHitsObjectiveCount: objectives.filter((row) => row.coverageStatus === "no_current_hits").length,
    contractCount: objectives.reduce((sum, row) => sum + row.contractCount, 0),
    manualOnlyContractCount: objectives.reduce((sum, row) => sum + row.manualOnlyContractCount, 0),
    uncoveredManualCount: objectives.reduce((sum, row) => sum + row.uncoveredManualCount, 0),
    remainingSafeActionCount: objectives.reduce((sum, row) => sum + row.remainingSafeActionCount, 0),
    missingValidationCommandCount: objectives.reduce((sum, row) => sum + row.missingValidationCommandCount, 0),
  };

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-detailed-objective-coverage.mjs --write",
    policy:
      "Prove detailed version-name checklist objectives using deterministic inventories, queues, allowlists, and manual-boundary evidence. Checklist docs are not configuration.",
    sourceArtifacts: {
      versionedRemainingSurfaceCoverage: "artifacts/compatibility/versioned-remaining-surface-coverage.json",
      versionedContentSurfaceCoverage: "artifacts/compatibility/versioned-content-surface-coverage.json",
      versionedContentContracts: "artifacts/compatibility/versioned-content-contract-inventory.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
      versionReferenceAllowlist: "scripts/version-reference-allowlist.json",
    },
    packageScriptReadiness: remainingCoverage.packageScriptReadiness,
    totals,
    objectives,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedDetailedObjectiveCoverage(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedDetailedObjectiveCoverage(root, options);
  const issues = [...current.issues];
  const artifactPath = path.join(root, artifactRel);
  if (!fs.existsSync(artifactPath)) {
    issues.push({ issue: "versioned_detailed_objective_coverage_missing", path: artifactRel });
  } else {
    const committed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (stableStringify(committed) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
      issues.push({
        issue: "versioned_detailed_objective_coverage_drift",
        path: artifactRel,
        hint: "Run npm run write:versioned-detailed-objective-coverage",
      });
    }
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    objectiveCount: current.totals.objectiveCount,
    coverageProvenObjectiveCount: current.totals.coverageProvenObjectiveCount,
    retainedLegacyObjectiveCount: current.totals.retainedLegacyObjectiveCount,
    uncoveredManualCount: current.totals.uncoveredManualCount,
    remainingSafeActionCount: current.totals.remainingSafeActionCount,
    missingValidationCommandCount: current.totals.missingValidationCommandCount,
    packageScriptAliasCount: current.packageScriptReadiness.aliasCount,
    packageScriptReadyForRemovalCount: current.packageScriptReadiness.readyForRemovalCount,
    issueCount: issues.length,
    issues,
    current: { ...current, issueCount: current.issues.length, issues: current.issues },
  };
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

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedDetailedObjectiveCoverage(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

export function runVersionedDetailedObjectiveCoverage(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issues.length === 0,
          wrote: options.artifactRel,
          objectiveCount: artifact.totals.objectiveCount,
          coverageProvenObjectiveCount: artifact.totals.coverageProvenObjectiveCount,
          retainedLegacyObjectiveCount: artifact.totals.retainedLegacyObjectiveCount,
          uncoveredManualCount: artifact.totals.uncoveredManualCount,
          remainingSafeActionCount: artifact.totals.remainingSafeActionCount,
          missingValidationCommandCount: artifact.totals.missingValidationCommandCount,
          packageScriptAliasCount: artifact.packageScriptReadiness.aliasCount,
          packageScriptReadyForRemovalCount: artifact.packageScriptReadiness.readyForRemovalCount,
          issueCount: artifact.issues.length,
          issues: artifact.issues,
        },
        null,
        2,
      ),
    );
    if (artifact.issues.length > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeVersionedDetailedObjectiveCoverage(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedDetailedObjectiveCoverage();
}
