#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeVersionedAdditiveAliasPreservation } from "./check-versioned-additive-alias-preservation.mjs";
import { analyzeVersionedCodeOnlyClosure } from "./check-versioned-code-only-closure.mjs";
import { buildVersionedContentSurfaceCoverage } from "./check-versioned-content-surface-coverage.mjs";
import { analyzeVersionedLocalSurfaceRegression } from "./check-versioned-local-surface-regression.mjs";
import { analyzeVersionedPackageScriptReadiness } from "./check-versioned-package-script-readiness.mjs";
import { analyzeVersionedPublicContractPreservation } from "./check-versioned-public-contract-preservation.mjs";
import { buildVersionedRemainingSurfaceCoverage } from "./check-versioned-remaining-surface-coverage.mjs";
import { analyzeSeedVersionedNameQueueCoverage } from "./check-seed-versioned-name-queue-coverage.mjs";
import { analyzeVersionedSourceConfigPreservation } from "./check-versioned-source-config-preservation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-remaining-local-contract-closure.json";

const OBJECTIVE_TAXONOMY = [
  {
    id: "static_text_fixture_snapshot_closure",
    owner: "platform-hardening",
    reason: "Static text, comments, fixtures, and snapshots are closed only when classified, queued, allowlisted, or explicitly manual.",
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Rewrite only manifest-proven local text; retain historical evidence and standards/provider/schema version strings.",
    source: "localSurfaceRegression",
    groupIds: ["copy_and_localization_keys", "test_tags_skip_and_snapshot_prefixes"],
  },
  {
    id: "skip_metadata_visual_snapshot_evidence_keys",
    owner: "test-platform",
    reason: "Skip metadata, visual snapshot prefixes, evidence keys, and QA registries need deterministic queue or manual-boundary coverage.",
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Keep retained test metadata queued until snapshots, fixtures, and support references use neutral names.",
    source: "localSurfaceRegression",
    groupIds: ["fixtures_evidence_and_qa_registries", "test_tags_skip_and_snapshot_prefixes"],
  },
  {
    id: "dom_selector_accessibility_aliases",
    owner: "frontend-platform",
    reason: "Old and neutral DOM selectors must coexist without changing accessibility semantics while support tooling migrates.",
    validationCommand: "npm run check:versioned-additive-alias-preservation",
    manualFollowUp: "Remove legacy selector attributes only after UI tests, analytics, and support tooling consume neutral selectors.",
    source: "domAliases",
  },
  {
    id: "style_token_copy_key_readiness",
    owner: "frontend-platform",
    reason: "Style tokens and copy keys can be user-facing contracts, so retained version labels need explicit classification and queue coverage.",
    validationCommand: "npm run check:versioned-local-surface-regression",
    manualFollowUp: "Add runtime-safe aliases before removing legacy style or copy keys.",
    source: "localSurfaceRegression",
    groupIds: ["copy_and_localization_keys", "style_tokens_and_visual_keys"],
  },
  {
    id: "public_metadata_pwa_readiness",
    owner: "frontend-platform",
    reason: "Public metadata, PWA, and well-known names need runtime aliases or external cutover before old names can be removed.",
    validationCommand: "npm run check:versioned-public-contract-preservation",
    manualFollowUp: "Leave public metadata and PWA cutover unchecked until old and neutral public contracts are both validated.",
    source: "publicContractPreservation",
    groupIds: ["public_metadata_assets", "pwa_well_known_install"],
    defaultCoveredStatus: "requires_runtime_alias",
  },
  {
    id: "seed_payload_key_readiness",
    owner: "database-platform",
    reason: "Seed and local-reset payload keys are closed only when queued, schema-compatible, or covered by dual-read support.",
    validationCommand: "npm run check:seed-versioned-name-queue-coverage",
    manualFollowUp: "Do not remove legacy seed keys until reset fixtures and runtime readers accept neutral names.",
    source: "seedQueueCoverage",
  },
  {
    id: "source_scanner_id_preservation",
    owner: "platform-security",
    reason: "Source-owned scanner IDs and Semgrep packs must prefer neutral active IDs while retaining legacy packs for SARIF history.",
    validationCommand: "npm run check:versioned-source-config-preservation",
    manualFollowUp: "Keep legacy scanner IDs queued until historical SARIF and suppressions no longer reference them.",
    source: "sourceScannerPreservation",
    groupIds: ["source_owned_config_scanner_ids"],
  },
  {
    id: "package_script_retained_aliases",
    owner: "platform-hardening",
    reason: "Legacy package-script aliases remain callable until external runbooks and branch-protection references are explicitly retired.",
    validationCommand: "npm run check:versioned-package-script-readiness",
    manualFollowUp: "Do not remove legacy package scripts until every alias reports ready_for_removal and removal is in scope.",
    source: "packageScriptReadiness",
  },
  {
    id: "code_only_safe_action_exhaustion",
    owner: "platform-hardening",
    reason: "Safe path renames, exported-symbol aliases, local content rewrites, env aliases, and alias-usage rewrites must be exhausted.",
    validationCommand: "npm run check:versioned-code-only-closure",
    manualFollowUp: "If a new safe action appears, apply it through the owning explicit write command and rerun closure checks.",
    source: "codeOnlyClosure",
  },
  {
    id: "remaining_surface_queue_completeness",
    owner: "platform-hardening",
    reason: "Remaining content surfaces must have queue, allowlist, validation-command, and manual-boundary evidence.",
    validationCommand: "npm run check:versioned-remaining-surface-coverage",
    manualFollowUp: "Keep compatibility-sensitive names retained until their queue status reaches ready_for_removal.",
    source: "remainingSurfaceCoverage",
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

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function sortedObject(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function defaultSourceReports(root) {
  return {
    contentSurfaceCoverage: buildVersionedContentSurfaceCoverage(root),
    remainingSurfaceCoverage: buildVersionedRemainingSurfaceCoverage(root),
    localSurfaceRegression: analyzeVersionedLocalSurfaceRegression({ root }),
    publicContractPreservation: analyzeVersionedPublicContractPreservation({ root }),
    sourceConfigPreservation: analyzeVersionedSourceConfigPreservation({ root }),
    seedQueueCoverage: analyzeSeedVersionedNameQueueCoverage({ root }),
    packageScriptReadiness: analyzeVersionedPackageScriptReadiness({ root }),
    codeOnlyClosure: analyzeVersionedCodeOnlyClosure({ root }),
    additiveAliasPreservation: analyzeVersionedAdditiveAliasPreservation({ root }),
  };
}

function reportIssues(report) {
  return report?.issues ?? [];
}

function sourceIssueSummaries(sources) {
  return [
    ["versioned_content_surface_coverage", sources.contentSurfaceCoverage],
    ["versioned_remaining_surface_coverage", sources.remainingSurfaceCoverage],
    ["versioned_local_surface_regression", sources.localSurfaceRegression],
    ["versioned_public_contract_preservation", sources.publicContractPreservation],
    ["versioned_source_config_preservation", sources.sourceConfigPreservation],
    ["seed_versioned_name_queue_coverage", sources.seedQueueCoverage],
    ["versioned_package_script_readiness", sources.packageScriptReadiness],
    ["versioned_code_only_closure", sources.codeOnlyClosure],
    ["versioned_additive_alias_preservation", sources.additiveAliasPreservation],
  ].flatMap(([source, report]) => {
    const issues = reportIssues(report);
    const issueCount = Number(report?.issueCount ?? issues.length);
    if (issueCount === 0) return [];
    return [
      issue("versioned_remaining_local_contract_closure_source_issues", {
        source,
        issueCount,
        sampleIssues: issues.slice(0, 5),
      }),
    ];
  });
}

function currentGroups(report) {
  return report?.current?.groups ?? report?.groups ?? [];
}

function groupById(report) {
  return new Map(currentGroups(report).map((row) => [row.id, row]));
}

function pickGroups(report, ids) {
  const byId = groupById(report);
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function countFields(rows) {
  return {
    contractCount: rows.reduce((sum, row) => sum + Number(row.contractCount ?? 0), 0),
    manualOnlyContractCount: rows.reduce((sum, row) => sum + Number(row.manualOnlyContractCount ?? 0), 0),
    uncoveredManualCount: rows.reduce((sum, row) => sum + Number(row.uncoveredManualCount ?? 0), 0),
    remainingSafeActionCount: rows.reduce((sum, row) => sum + Number(row.remainingSafeActionCount ?? 0), 0),
    missingMetadataCount: rows.reduce((sum, row) => sum + Number(row.missingMetadataCount ?? 0), 0),
    missingValidationCommandCount: rows.reduce((sum, row) => sum + Number(row.missingValidationCommandCount ?? 0), 0),
  };
}

function statusForCounts(counts, coveredStatus = "coverage_proven") {
  if (
    counts.uncoveredManualCount +
      counts.remainingSafeActionCount +
      counts.missingMetadataCount +
      counts.missingValidationCommandCount ===
    0
  ) {
    return coveredStatus;
  }
  return "coverage_gap";
}

function objectiveFromGroups(taxonomy, report) {
  const groups = pickGroups(report, taxonomy.groupIds ?? []);
  const counts = countFields(groups);
  return {
    ...baseObjective(taxonomy),
    closureStatus: statusForCounts(counts, taxonomy.defaultCoveredStatus),
    sourceGroupIds: groups.map((row) => row.id),
    ...counts,
  };
}

function objectiveFromDomAliases(taxonomy, report) {
  const current = report?.current ?? report ?? {};
  const totals = current.totals ?? {};
  const domAliasPairCount = Number(report?.domAliasPairCount ?? totals.domAliasPairCount ?? 0);
  const coveredDomAliasPairCount = Number(report?.coveredDomAliasPairCount ?? totals.coveredDomAliasPairCount ?? 0);
  const semgrepNeutralRulepackActive = Boolean(report?.semgrepNeutralRulepackActive ?? current.semgrep?.neutralRulepackActive);
  const closureStatus =
    domAliasPairCount === coveredDomAliasPairCount && semgrepNeutralRulepackActive ? "coverage_proven" : "coverage_gap";
  return {
    ...baseObjective(taxonomy),
    closureStatus,
    domAliasPairCount,
    coveredDomAliasPairCount,
    semgrepNeutralRulepackActive,
    contractCount: domAliasPairCount,
    manualOnlyContractCount: domAliasPairCount,
    uncoveredManualCount: 0,
    remainingSafeActionCount: domAliasPairCount - coveredDomAliasPairCount,
    missingMetadataCount: 0,
    missingValidationCommandCount: 0,
  };
}

function objectiveFromSeedQueue(taxonomy, report) {
  return {
    ...baseObjective(taxonomy),
    closureStatus: Number(report?.issueCount ?? 0) === 0 ? "coverage_proven" : "coverage_gap",
    contractCount: Number(report?.queueCoveredCount ?? report?.current?.queueCoveredCount ?? 0),
    manualOnlyContractCount: Number(report?.manualOnlyCount ?? report?.current?.manualOnlyCount ?? 0),
    uncoveredManualCount: Number(report?.uncoveredManualCount ?? report?.current?.uncoveredManualCount ?? 0),
    remainingSafeActionCount: 0,
    missingMetadataCount: 0,
    missingValidationCommandCount: 0,
  };
}

function objectiveFromSourceScanner(taxonomy, sourceConfigReport, additiveReport) {
  const groupObjective = objectiveFromGroups(taxonomy, sourceConfigReport);
  const current = additiveReport?.current ?? additiveReport ?? {};
  const semgrep = current.semgrep ?? {};
  const semgrepNeutralRulepackActive = Boolean(additiveReport?.semgrepNeutralRulepackActive ?? semgrep.neutralRulepackActive);
  const legacyRulepacksInactiveInCi = Boolean(semgrep.legacyRulepacksInactiveInCi ?? semgrep.legacyRulepacksInactive);
  const versionedActiveRuleIdCount = Number(semgrep.versionedActiveRuleIdCount ?? 0);
  const semgrepOk = semgrepNeutralRulepackActive && legacyRulepacksInactiveInCi && versionedActiveRuleIdCount === 0;
  return {
    ...groupObjective,
    closureStatus: groupObjective.closureStatus === "coverage_proven" && semgrepOk ? "coverage_proven" : "coverage_gap",
    semgrepNeutralRulepackActive,
    legacyRulepacksInactiveInCi,
    versionedActiveRuleIdCount,
  };
}

function objectiveFromPackageReadiness(taxonomy, report) {
  const aliasCount = Number(report?.aliasCount ?? report?.current?.aliasCount ?? 0);
  const readyForRemovalCount = Number(report?.readyForRemovalCount ?? report?.current?.readyForRemovalCount ?? 0);
  const blockingReferenceCount = Number(report?.blockingReferenceCount ?? report?.current?.blockingReferenceCount ?? 0);
  const closureStatus =
    Number(report?.issueCount ?? 0) === 0 && blockingReferenceCount === 0
      ? readyForRemovalCount === aliasCount && aliasCount > 0
        ? "coverage_proven"
        : "retained_legacy_blocked"
      : "coverage_gap";
  return {
    ...baseObjective(taxonomy),
    closureStatus,
    aliasCount,
    readyForRemovalCount,
    localReadyForRemovalCount: Number(report?.localReadyForRemovalCount ?? report?.current?.localReadyForRemovalCount ?? 0),
    blockingReferenceCount,
    contractCount: aliasCount,
    manualOnlyContractCount: aliasCount,
    uncoveredManualCount: 0,
    remainingSafeActionCount: 0,
    missingMetadataCount: 0,
    missingValidationCommandCount: 0,
  };
}

function objectiveFromCodeOnlyClosure(taxonomy, report) {
  const pendingSafeActionCount = Number(report?.pendingSafeActionCount ?? report?.current?.totals?.pendingSafeActionCount ?? 0);
  return {
    ...baseObjective(taxonomy),
    closureStatus: Number(report?.issueCount ?? 0) === 0 && pendingSafeActionCount === 0 ? "coverage_proven" : "coverage_gap",
    pendingSafeActionCount,
    contractCount: Number(report?.objectiveCount ?? report?.current?.totals?.objectiveCount ?? 0),
    manualOnlyContractCount: Number(report?.retainedLegacyAliasCount ?? report?.current?.totals?.retainedLegacyAliasCount ?? 0),
    uncoveredManualCount: 0,
    remainingSafeActionCount: pendingSafeActionCount,
    missingMetadataCount: 0,
    missingValidationCommandCount: 0,
  };
}

function objectiveFromRemainingSurface(taxonomy, report) {
  const categories = report?.categories ?? report?.current?.categories ?? [];
  const totals = report?.totals ?? report?.current?.totals ?? {};
  const uncoveredManualCount = Number(totals.uncoveredManualCount ?? 0);
  const remainingSafeActionCount = Number(totals.remainingSafeActionCount ?? 0);
  const missingMetadataCount = Number(totals.missingMetadataCount ?? 0);
  const missingValidationCommandCount = Number(totals.missingValidationCommandCount ?? 0);
  return {
    ...baseObjective(taxonomy),
    closureStatus:
      uncoveredManualCount + remainingSafeActionCount + missingMetadataCount + missingValidationCommandCount === 0
        ? "coverage_proven"
        : "coverage_gap",
    categoryCount: categories.length,
    contractCount: Number(totals.contractCount ?? 0),
    manualOnlyContractCount: Number(totals.manualOnlyContractCount ?? 0),
    uncoveredManualCount,
    remainingSafeActionCount,
    missingMetadataCount,
    missingValidationCommandCount,
  };
}

function baseObjective(taxonomy) {
  return {
    id: taxonomy.id,
    owner: taxonomy.owner,
    reason: taxonomy.reason,
    validationCommand: taxonomy.validationCommand,
    manualFollowUp: taxonomy.manualFollowUp,
  };
}

function objectiveFor(taxonomy, sources) {
  if (taxonomy.source === "localSurfaceRegression") return objectiveFromGroups(taxonomy, sources.localSurfaceRegression);
  if (taxonomy.source === "publicContractPreservation") return objectiveFromGroups(taxonomy, sources.publicContractPreservation);
  if (taxonomy.source === "domAliases") return objectiveFromDomAliases(taxonomy, sources.additiveAliasPreservation);
  if (taxonomy.source === "seedQueueCoverage") return objectiveFromSeedQueue(taxonomy, sources.seedQueueCoverage);
  if (taxonomy.source === "sourceScannerPreservation") {
    return objectiveFromSourceScanner(taxonomy, sources.sourceConfigPreservation, sources.additiveAliasPreservation);
  }
  if (taxonomy.source === "packageScriptReadiness") return objectiveFromPackageReadiness(taxonomy, sources.packageScriptReadiness);
  if (taxonomy.source === "codeOnlyClosure") return objectiveFromCodeOnlyClosure(taxonomy, sources.codeOnlyClosure);
  if (taxonomy.source === "remainingSurfaceCoverage") return objectiveFromRemainingSurface(taxonomy, sources.remainingSurfaceCoverage);
  return { ...baseObjective(taxonomy), closureStatus: "coverage_gap" };
}

function validateObjective(row) {
  const issues = [];
  for (const key of ["owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("versioned_remaining_local_contract_closure_missing_objective_metadata", { objective: row.id, key }));
    }
  }
  if (row.closureStatus === "coverage_gap") {
    issues.push(
      issue("versioned_remaining_local_contract_closure_coverage_gap", {
        objective: row.id,
        validationCommand: row.validationCommand,
      }),
    );
  }
  if (Number(row.uncoveredManualCount ?? 0) > 0) {
    issues.push(issue("versioned_remaining_local_contract_closure_uncovered_manual_rows", { objective: row.id, count: row.uncoveredManualCount }));
  }
  if (Number(row.remainingSafeActionCount ?? 0) > 0) {
    issues.push(issue("versioned_remaining_local_contract_closure_pending_safe_actions", { objective: row.id, count: row.remainingSafeActionCount }));
  }
  if (Number(row.missingMetadataCount ?? 0) > 0) {
    issues.push(issue("versioned_remaining_local_contract_closure_missing_row_metadata", { objective: row.id, count: row.missingMetadataCount }));
  }
  if (Number(row.missingValidationCommandCount ?? 0) > 0) {
    issues.push(
      issue("versioned_remaining_local_contract_closure_missing_validation_commands", {
        objective: row.id,
        count: row.missingValidationCommandCount,
      }),
    );
  }
  return issues;
}

export function buildVersionedRemainingLocalContractClosure(root = DEFAULT_ROOT, options = {}) {
  const sources = options.sources ?? defaultSourceReports(root);
  const objectives = OBJECTIVE_TAXONOMY.map((taxonomy) => objectiveFor(taxonomy, sources)).sort((a, b) => a.id.localeCompare(b.id));
  const statusCounts = {};
  for (const row of objectives) statusCounts[row.closureStatus] = (statusCounts[row.closureStatus] ?? 0) + 1;

  const issues = [
    ...sourceIssueSummaries(sources),
    ...objectives.flatMap(validateObjective),
  ];

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-remaining-local-contract-closure.mjs --write",
    policy:
      "Prove remaining repo-local version-name surfaces are classified, queued, allowlisted, alias-preserved, or blocked by explicit compatibility boundaries. Checklist docs are not configuration.",
    sourceArtifacts: {
      versionedContentSurfaceCoverage: "artifacts/compatibility/versioned-content-surface-coverage.json",
      versionedRemainingSurfaceCoverage: "artifacts/compatibility/versioned-remaining-surface-coverage.json",
      versionedLocalSurfaceRegression: "artifacts/compatibility/versioned-local-surface-regression.json",
      versionedAdditiveAliasPreservation: "artifacts/compatibility/versioned-additive-alias-preservation.json",
      versionedCodeOnlyClosure: "artifacts/compatibility/versioned-code-only-closure.json",
      versionedPackageScriptReadiness: "artifacts/compatibility/versioned-package-script-readiness.json",
      seedVersionedNameQueueCoverage: "artifacts/supabase/seed-versioned-name-queue-coverage.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
    },
    totals: {
      objectiveCount: objectives.length,
      statusCounts: sortedObject(statusCounts),
      coverageProvenCount: statusCounts.coverage_proven ?? 0,
      retainedLegacyBlockedCount: statusCounts.retained_legacy_blocked ?? 0,
      requiresRuntimeAliasCount: statusCounts.requires_runtime_alias ?? 0,
      issueCount: issues.length,
    },
    objectives,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedRemainingLocalContractClosure(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedRemainingLocalContractClosure(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push(issue("versioned_remaining_local_contract_closure_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(artifact) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
    issues.push(
      issue("versioned_remaining_local_contract_closure_drift", {
        path: artifactRel,
        hint: "Run npm run write:versioned-remaining-local-contract-closure",
      }),
    );
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    objectiveCount: current.totals.objectiveCount,
    statusCounts: current.totals.statusCounts,
    issueCount: issues.length,
    issues,
    current,
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

export function runVersionedRemainingLocalContractClosure(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildVersionedRemainingLocalContractClosure(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
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

  const report = analyzeVersionedRemainingLocalContractClosure(options);
  const { current: _current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedRemainingLocalContractClosure();
}
