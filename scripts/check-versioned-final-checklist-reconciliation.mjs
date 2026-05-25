#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { analyzeVersionedCodeOnlyClosure } from "./check-versioned-code-only-closure.mjs";
import { analyzeVersionedExportedSymbolAliases } from "./check-versioned-exported-symbol-aliases.mjs";
import { analyzeVersionedForwardMigrationReadiness } from "./check-versioned-forward-migration-readiness.mjs";
import { analyzeVersionedLocalContentRewrites } from "./check-versioned-local-content-rewrites.mjs";
import { analyzeVersionedNamingSafeRenames } from "./check-versioned-naming-safe-renames.mjs";
import { analyzeVersionedPackageScriptReadiness } from "./check-versioned-package-script-readiness.mjs";
import { analyzeVersionedPublicRuntimeDualRead } from "./check-versioned-public-runtime-dual-read.mjs";
import { analyzeVersionedUncheckedObjectiveReadiness } from "./check-versioned-unchecked-objective-readiness.mjs";
import { analyzeSqlPolicyForwardMigrationBlueprint } from "./check-sql-policy-forward-migration-blueprint.mjs";
import { analyzeSqlPolicyPredicateEquivalence } from "./check-sql-policy-predicate-equivalence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-final-checklist-reconciliation.json";

const FINAL_STATUSES = new Set([
  "code_only_complete",
  "retained_legacy_blocked",
  "requires_forward_migration",
  "requires_external_or_production_cutover",
  "final_zero_blocked",
  "coverage_gap",
]);

const OBJECTIVE_TAXONOMY = [
  {
    id: "safe_path_export_and_content_actions",
    owner: "platform-hardening",
    reason: "Safe path renames, exported-symbol aliases, and local content rewrites are exhausted and remain guarded by read-only checks.",
    validationCommand: "npm run check:versioned-code-only-closure",
    manualFollowUp: "Run the owning explicit write command if a future scanner pass finds a new safe action.",
    sourceReports: ["versionedCodeOnlyClosure", "safeRenames", "exportedSymbolAliases", "localContentRewrites"],
    classifier: classifySafeActions,
  },
  {
    id: "public_runtime_dual_read_readiness",
    owner: "frontend-platform",
    reason: "Public route, deep-link, PWA, metadata, and OpenAPI version-name surfaces are classified as dual-read, alias-ready, queued, or externally blocked.",
    validationCommand: "npm run check:versioned-public-runtime-dual-read",
    manualFollowUp: "Keep public and PWA cutover items unchecked until external consumer and cache behavior evidence exists.",
    sourceReports: ["versionedPublicRuntimeDualRead", "compatibilityRemovalQueue"],
    classifier: classifyPublicRuntimeReadiness,
  },
  {
    id: "sql_forward_migration_readiness",
    owner: "database-platform",
    reason: "Neutral SQL function aliases are staged while table and policy rows remain blocked on safe forward migrations and linked verification.",
    validationCommand: "npm run check:versioned-forward-migration-readiness",
    manualFollowUp: "Do not mark SQL table or policy alias completion until forward migrations and linked read-only verification exist.",
    sourceReports: ["versionedForwardMigrationReadiness", "compatibilityRemovalQueue"],
    classifier: classifySqlForwardMigrationReadiness,
  },
  {
    id: "sql_policy_predicate_equivalence_staging",
    owner: "database-platform",
    reason: "Retained SQL policy rows have deterministic predicate evidence and generated read-only linked-verification SQL, while actual neutral policy migration remains blocked.",
    validationCommand: "npm run check:sql-policy-predicate-equivalence",
    manualFollowUp: "Run linked read-only verification and add a future forward migration before creating neutral policies or removing legacy policies.",
    sourceReports: ["sqlPolicyPredicateEquivalence", "versionedForwardMigrationReadiness", "compatibilityRemovalQueue"],
    classifier: classifySqlPolicyPredicateEquivalence,
  },
  {
    id: "sql_policy_forward_migration_blueprint",
    owner: "database-platform",
    reason: "Retained SQL policy rows have a non-executing forward-migration blueprint with future target requirements and linked-verification contexts.",
    validationCommand: "npm run check:sql-policy-forward-migration-blueprint",
    manualFollowUp:
      "Keep actual neutral policy migration unchecked until a policy-capable neutral target, linked verification, and a reviewed forward migration exist.",
    sourceReports: ["sqlPolicyForwardMigrationBlueprint", "versionedForwardMigrationReadiness", "compatibilityRemovalQueue"],
    classifier: classifySqlPolicyForwardMigrationBlueprint,
  },
  {
    id: "package_script_alias_retirement",
    owner: "platform-hardening",
    reason: "Legacy package-script aliases remain callable even though local references prefer neutral commands.",
    validationCommand: "npm run check:versioned-package-script-readiness",
    manualFollowUp: "Remove legacy package scripts only in a future explicit removal pass after queue readiness permits it.",
    sourceReports: ["versionedPackageScriptReadiness", "compatibilityRemovalQueue"],
    classifier: classifyPackageScriptRetirement,
  },
  {
    id: "compatibility_queue_and_artifact_evidence",
    owner: "platform-hardening",
    reason: "Remaining retained names are covered by compatibility queues, readiness artifacts, and deterministic artifact drift checks.",
    validationCommand: "npm run check:compatibility-removal-queue",
    manualFollowUp: "Refresh only with owning write commands and keep docs out of runtime configuration.",
    sourceReports: ["versionedCodeOnlyClosure", "versionedUncheckedObjectiveReadiness", "compatibilityRemovalQueue"],
    classifier: classifyQueueAndArtifactEvidence,
  },
  {
    id: "external_provider_telemetry_and_public_cutover",
    owner: "platform",
    reason: "Provider dashboards, persisted telemetry names, public route removal, traffic, scheduler, and secret changes require external or production evidence.",
    validationCommand: "npm run check:versioned-unchecked-objective-readiness",
    manualFollowUp: "Keep external/provider/telemetry cutover items unchecked until external evidence is available.",
    sourceReports: ["versionedUncheckedObjectiveReadiness", "compatibilityRemovalQueue"],
    classifier: classifyExternalCutover,
  },
  {
    id: "final_zero_version_enforcement",
    owner: "platform-hardening",
    reason: "Final zero-version enforcement remains blocked by retained compatibility names and production/external cutover work.",
    validationCommand: "npm run check:versioned-naming",
    manualFollowUp: "Keep final zero-version enforcement unchecked until every retained queue row is ready for removal and legacy names are removed in scope.",
    sourceReports: ["versionedCodeOnlyClosure", "versionedUncheckedObjectiveReadiness", "compatibilityRemovalQueue"],
    classifier: classifyFinalZero,
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

function defaultSources(root) {
  return {
    versionedCodeOnlyClosure: analyzeVersionedCodeOnlyClosure({ root }),
    versionedUncheckedObjectiveReadiness: analyzeVersionedUncheckedObjectiveReadiness({ root }),
    versionedForwardMigrationReadiness: analyzeVersionedForwardMigrationReadiness({ root }),
    sqlPolicyPredicateEquivalence: analyzeSqlPolicyPredicateEquivalence({ root }),
    sqlPolicyForwardMigrationBlueprint: analyzeSqlPolicyForwardMigrationBlueprint({ root }),
    versionedPublicRuntimeDualRead: analyzeVersionedPublicRuntimeDualRead({ root }),
    versionedPackageScriptReadiness: analyzeVersionedPackageScriptReadiness({ root }),
    compatibilityRemovalQueue: analyzeCompatibilityRemovalQueue({ root }),
    safeRenames: analyzeVersionedNamingSafeRenames({ root }),
    exportedSymbolAliases: analyzeVersionedExportedSymbolAliases({ root }),
    localContentRewrites: analyzeVersionedLocalContentRewrites({ root }),
  };
}

function reportIssueCount(report) {
  return Number(report?.issueCount ?? report?.issues?.length ?? 0);
}

function sourceIssueSummaries(sources) {
  return [
    ["versioned_code_only_closure", sources.versionedCodeOnlyClosure],
    ["versioned_unchecked_objective_readiness", sources.versionedUncheckedObjectiveReadiness],
    ["versioned_forward_migration_readiness", sources.versionedForwardMigrationReadiness],
    ["sql_policy_predicate_equivalence", sources.sqlPolicyPredicateEquivalence],
    ["sql_policy_forward_migration_blueprint", sources.sqlPolicyForwardMigrationBlueprint],
    ["versioned_public_runtime_dual_read", sources.versionedPublicRuntimeDualRead],
    ["versioned_package_script_readiness", sources.versionedPackageScriptReadiness],
    ["compatibility_removal_queue", sources.compatibilityRemovalQueue],
    ["versioned_naming_safe_renames", sources.safeRenames],
    ["versioned_exported_symbol_aliases", sources.exportedSymbolAliases],
    ["versioned_local_content_rewrites", sources.localContentRewrites],
  ].flatMap(([source, report]) => {
    const issueCount = reportIssueCount(report);
    if (issueCount === 0) return [];
    return [
      issue("versioned_final_checklist_reconciliation_source_issues", {
        source,
        issueCount,
        sampleIssues: (report?.issues ?? []).slice(0, 5),
      }),
    ];
  });
}

function queueCount(sources, queueName) {
  const queues = sources.compatibilityRemovalQueue?.current?.queues ?? sources.compatibilityRemovalQueue?.queues ?? {};
  return Array.isArray(queues[queueName]) ? queues[queueName].length : 0;
}

function totalsFrom(report) {
  return report?.current?.totals ?? report?.totals ?? {};
}

function counts({
  uncoveredScannerRowCount = 0,
  missingValidationCommandCount = 0,
  pendingSafeActionCount = 0,
  missingMetadataCount = 0,
} = {}) {
  return {
    uncoveredScannerRowCount: Number(uncoveredScannerRowCount),
    missingValidationCommandCount: Number(missingValidationCommandCount),
    pendingSafeActionCount: Number(pendingSafeActionCount),
    missingMetadataCount: Number(missingMetadataCount),
  };
}

function sourceOk(sources, names) {
  return names.every((name) => reportIssueCount(sources[name]) === 0);
}

function classifySafeActions(sources) {
  const closureTotals = totalsFrom(sources.versionedCodeOnlyClosure);
  const pendingSafeActionCount =
    Number(closureTotals.pendingSafeActionCount ?? sources.versionedCodeOnlyClosure?.pendingSafeActionCount ?? 0) +
    Number(sources.safeRenames?.pendingRenameCount ?? 0) +
    Number(sources.exportedSymbolAliases?.pendingAliasCount ?? 0) +
    Number(sources.exportedSymbolAliases?.blockedAliasCount ?? 0) +
    Number(sources.localContentRewrites?.pendingRewriteCount ?? 0);
  return {
    finalStatus: sourceOk(sources, ["versionedCodeOnlyClosure", "safeRenames", "exportedSymbolAliases", "localContentRewrites"]) &&
      pendingSafeActionCount === 0
      ? "code_only_complete"
      : "coverage_gap",
    evidence: {
      pendingSafeActionCount,
      appliedRenameCount: Number(sources.safeRenames?.appliedRenameCount ?? 0),
      exportedAliasPendingCount: Number(sources.exportedSymbolAliases?.pendingAliasCount ?? 0),
      localContentPendingRewriteCount: Number(sources.localContentRewrites?.pendingRewriteCount ?? 0),
    },
    counts: counts({ pendingSafeActionCount }),
  };
}

function classifyPublicRuntimeReadiness(sources) {
  const totals = totalsFrom(sources.versionedPublicRuntimeDualRead);
  const remainingSafeActionCount = Number(totals.remainingSafeActionCount ?? sources.versionedPublicRuntimeDualRead?.remainingSafeActionCount ?? 0);
  const missingValidationCommandCount = Number(totals.missingValidationCommandCount ?? 0);
  const missingMetadataCount = Number(totals.missingMetadataCount ?? 0);
  const uncoveredScannerRowCount = Number(totals.uncoveredManualCount ?? 0) + Number(totals.missingQueueCoverageCount ?? 0);
  return {
    finalStatus:
      sourceOk(sources, ["versionedPublicRuntimeDualRead", "compatibilityRemovalQueue"]) &&
      remainingSafeActionCount + missingValidationCommandCount + missingMetadataCount + uncoveredScannerRowCount === 0
        ? "code_only_complete"
        : "coverage_gap",
    evidence: {
      statusCounts: sources.versionedPublicRuntimeDualRead?.statusCounts ?? totals.statusCounts ?? {},
      dualReadPresentCount: Number(sources.versionedPublicRuntimeDualRead?.dualReadPresentCount ?? totals.dualReadPresentCount ?? 0),
      queueCoveredCount: Number(sources.versionedPublicRuntimeDualRead?.queueCoveredCount ?? totals.queueCoveredCount ?? 0),
    },
    counts: counts({ uncoveredScannerRowCount, missingValidationCommandCount, pendingSafeActionCount: remainingSafeActionCount, missingMetadataCount }),
  };
}

function classifySqlForwardMigrationReadiness(sources) {
  const totals = totalsFrom(sources.versionedForwardMigrationReadiness);
  const requiresForwardMigrationCount = Number(
    sources.versionedForwardMigrationReadiness?.requiresForwardMigrationCount ?? totals.requiresForwardMigrationCount ?? 0,
  );
  return {
    finalStatus:
      sourceOk(sources, ["versionedForwardMigrationReadiness", "compatibilityRemovalQueue"]) && requiresForwardMigrationCount > 0
        ? "requires_forward_migration"
        : sourceOk(sources, ["versionedForwardMigrationReadiness", "compatibilityRemovalQueue"])
          ? "code_only_complete"
          : "coverage_gap",
    evidence: {
      rowCount: Number(sources.versionedForwardMigrationReadiness?.rowCount ?? totals.rowCount ?? 0),
      aliasAddedCount: Number(sources.versionedForwardMigrationReadiness?.aliasAddedCount ?? totals.aliasAddedCount ?? 0),
      requiresForwardMigrationCount,
      blockerClassCounts: sources.versionedForwardMigrationReadiness?.blockerClassCounts ?? totals.blockerClassCounts ?? {},
      sqlObjectQueueCount: queueCount(sources, "sqlObjects"),
    },
    counts: counts(),
  };
}

function classifySqlPolicyPredicateEquivalence(sources) {
  const totals = totalsFrom(sources.sqlPolicyPredicateEquivalence);
  const policyRowCount = Number(sources.sqlPolicyPredicateEquivalence?.policyRowCount ?? totals.policyRowCount ?? 0);
  const predicateEvidenceCount = Number(totals.predicateEvidenceCount ?? 0);
  const manualLinkedVerificationRequiredCount = Number(totals.manualLinkedVerificationRequiredCount ?? 0);
  const missingValidationCommandCount = Number(totals.missingValidationCommandCount ?? 0);
  const missingMetadataCount = Number(totals.missingMetadataCount ?? 0);
  const uncoveredScannerRowCount =
    Number(totals.policyRowCount ?? 0) -
    Math.min(
      Number(totals.queueCoveredCount ?? 0),
      Number(totals.verificationSqlCoveredCount ?? 0),
      Number(totals.neutralTableViewAliasCoveredCount ?? 0),
      predicateEvidenceCount,
    );
  const isComplete =
    sourceOk(sources, ["sqlPolicyPredicateEquivalence", "versionedForwardMigrationReadiness", "compatibilityRemovalQueue"]) &&
    policyRowCount > 0 &&
    uncoveredScannerRowCount === 0 &&
    missingValidationCommandCount === 0 &&
    missingMetadataCount === 0;
  return {
    finalStatus: isComplete ? "code_only_complete" : "coverage_gap",
    evidence: {
      policyRowCount,
      statusCounts: sources.sqlPolicyPredicateEquivalence?.statusCounts ?? totals.statusCounts ?? {},
      blockerClassCounts: sources.sqlPolicyPredicateEquivalence?.blockerClassCounts ?? totals.blockerClassCounts ?? {},
      linkedVerificationKindCounts:
        sources.sqlPolicyPredicateEquivalence?.linkedVerificationKindCounts ?? totals.linkedVerificationKindCounts ?? {},
      predicateEvidenceCount,
      manualLinkedVerificationRequiredCount,
    },
    counts: counts({ uncoveredScannerRowCount, missingValidationCommandCount, missingMetadataCount }),
  };
}

function classifySqlPolicyForwardMigrationBlueprint(sources) {
  const totals = totalsFrom(sources.sqlPolicyForwardMigrationBlueprint);
  const policyRowCount = Number(sources.sqlPolicyForwardMigrationBlueprint?.policyRowCount ?? totals.policyRowCount ?? 0);
  const coveredCount = Math.min(
    Number(totals.queueCoveredCount ?? 0),
    Number(totals.predicateEquivalenceCoveredCount ?? 0),
    Number(totals.policyAliasReadinessCoveredCount ?? 0),
    Number(totals.verificationSqlCoveredCount ?? 0),
    Number(totals.sqlSecurityAutomationCoveredCount ?? 0),
    Number(totals.neutralTableViewAliasCoveredCount ?? 0),
    Number(totals.stagingCoveredCount ?? 0),
  );
  const uncoveredScannerRowCount = Math.max(0, policyRowCount - coveredCount);
  const pendingSafeActionCount = Number(totals.migratableInThisPassCount ?? 0);
  const missingValidationCommandCount = Number(totals.missingValidationCommandCount ?? 0);
  const missingMetadataCount = Number(totals.missingMetadataCount ?? 0);
  const isComplete =
    sourceOk(sources, ["sqlPolicyForwardMigrationBlueprint", "versionedForwardMigrationReadiness", "compatibilityRemovalQueue"]) &&
    policyRowCount > 0 &&
    uncoveredScannerRowCount === 0 &&
    pendingSafeActionCount === 0 &&
    missingValidationCommandCount === 0 &&
    missingMetadataCount === 0;
  return {
    finalStatus: isComplete ? "code_only_complete" : "coverage_gap",
    evidence: {
      policyRowCount,
      statusCounts: sources.sqlPolicyForwardMigrationBlueprint?.statusCounts ?? totals.statusCounts ?? {},
      blockerClassCounts: sources.sqlPolicyForwardMigrationBlueprint?.blockerClassCounts ?? totals.blockerClassCounts ?? {},
      requiredPredicateEquivalenceLinkedContextCounts:
        sources.sqlPolicyForwardMigrationBlueprint?.requiredPredicateEquivalenceLinkedContextCounts ??
        totals.requiredPredicateEquivalenceLinkedContextCounts ??
        {},
      futureTargetRequirementCounts: totals.futureTargetRequirementCounts ?? {},
      migratableInThisPassCount: pendingSafeActionCount,
      commentOnlyFutureDdlPlaceholderCount: Number(totals.commentOnlyFutureDdlPlaceholderCount ?? 0),
    },
    counts: counts({ uncoveredScannerRowCount, missingValidationCommandCount, pendingSafeActionCount, missingMetadataCount }),
  };
}

function classifyPackageScriptRetirement(sources) {
  const packageReport = sources.versionedPackageScriptReadiness ?? {};
  const aliasCount = Number(packageReport.aliasCount ?? packageReport.current?.aliasCount ?? 0);
  const readyForRemovalCount = Number(packageReport.readyForRemovalCount ?? packageReport.current?.readyForRemovalCount ?? 0);
  const blockingReferenceCount = Number(packageReport.blockingReferenceCount ?? packageReport.current?.blockingReferenceCount ?? 0);
  return {
    finalStatus:
      sourceOk(sources, ["versionedPackageScriptReadiness", "compatibilityRemovalQueue"]) &&
      aliasCount > 0 &&
      readyForRemovalCount < aliasCount
        ? "retained_legacy_blocked"
        : sourceOk(sources, ["versionedPackageScriptReadiness", "compatibilityRemovalQueue"]) && aliasCount > 0
          ? "code_only_complete"
          : "coverage_gap",
    evidence: {
      aliasCount,
      localReadyForRemovalCount: Number(packageReport.localReadyForRemovalCount ?? packageReport.current?.localReadyForRemovalCount ?? 0),
      readyForRemovalCount,
      blockingReferenceCount,
      queueCount: queueCount(sources, "packageScriptAliases"),
    },
    counts: counts({ pendingSafeActionCount: blockingReferenceCount }),
  };
}

function classifyQueueAndArtifactEvidence(sources) {
  const closureTotals = totalsFrom(sources.versionedCodeOnlyClosure);
  const readinessTotals = totalsFrom(sources.versionedUncheckedObjectiveReadiness);
  const pendingSafeActionCount =
    Number(closureTotals.pendingSafeActionCount ?? 0) + Number(readinessTotals.remainingSafeActionCount ?? 0);
  const missingValidationCommandCount = Number(readinessTotals.missingValidationCommandCount ?? 0);
  const uncoveredScannerRowCount = Number(readinessTotals.uncoveredManualCount ?? 0);
  const missingMetadataCount = Number(readinessTotals.missingMetadataCount ?? 0);
  return {
    finalStatus:
      sourceOk(sources, ["versionedCodeOnlyClosure", "versionedUncheckedObjectiveReadiness", "compatibilityRemovalQueue"]) &&
      pendingSafeActionCount + missingValidationCommandCount + uncoveredScannerRowCount + missingMetadataCount === 0
        ? "code_only_complete"
        : "coverage_gap",
    evidence: {
      codeOnlyStatusCounts: closureTotals.statusCounts ?? {},
      uncheckedReadinessStatusCounts: readinessTotals.statusCounts ?? {},
      compatibilityQueueIssueCount: reportIssueCount(sources.compatibilityRemovalQueue),
    },
    counts: counts({ pendingSafeActionCount, missingValidationCommandCount, uncoveredScannerRowCount, missingMetadataCount }),
  };
}

function classifyExternalCutover(sources) {
  const readinessTotals = totalsFrom(sources.versionedUncheckedObjectiveReadiness);
  return {
    finalStatus: sourceOk(sources, ["versionedUncheckedObjectiveReadiness", "compatibilityRemovalQueue"])
      ? "requires_external_or_production_cutover"
      : "coverage_gap",
    evidence: {
      requiresExternalOrProductionCutoverCount: Number(readinessTotals.requiresExternalOrProductionCutoverCount ?? 0),
      telemetryQueueCount: queueCount(sources, "telemetryEventNames"),
      apiRouteQueueCount: queueCount(sources, "apiRoutes"),
      cronRouteQueueCount: queueCount(sources, "cronRoutes"),
    },
    counts: counts(),
  };
}

function classifyFinalZero(sources) {
  const closureTotals = totalsFrom(sources.versionedCodeOnlyClosure);
  return {
    finalStatus: sourceOk(sources, ["versionedCodeOnlyClosure", "versionedUncheckedObjectiveReadiness", "compatibilityRemovalQueue"])
      ? "final_zero_blocked"
      : "coverage_gap",
    evidence: {
      pendingSafeActionCount: Number(closureTotals.pendingSafeActionCount ?? 0),
      retainedLegacyAliasCount: Number(closureTotals.retainedLegacyAliasCount ?? 0),
      packageScriptAliasCount: Number(closureTotals.packageScriptAliasCount ?? 0),
      currentValidationCommand: "npm run check:versioned-naming",
    },
    counts: counts({ pendingSafeActionCount: Number(closureTotals.pendingSafeActionCount ?? 0) }),
  };
}

function buildObjective(taxonomy, sources) {
  const classified = taxonomy.classifier(sources);
  return {
    id: taxonomy.id,
    owner: taxonomy.owner,
    reason: taxonomy.reason,
    validationCommand: taxonomy.validationCommand,
    manualFollowUp: taxonomy.manualFollowUp,
    finalStatus: classified.finalStatus,
    sourceReports: taxonomy.sourceReports,
    ...classified.counts,
    evidence: classified.evidence,
  };
}

function validateObjective(row) {
  const issues = [];
  for (const key of ["owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("versioned_final_checklist_reconciliation_missing_objective_metadata", { objective: row.id, key }));
    }
  }
  if (!FINAL_STATUSES.has(row.finalStatus)) {
    issues.push(issue("versioned_final_checklist_reconciliation_unknown_status", { objective: row.id, finalStatus: row.finalStatus }));
  }
  if (row.finalStatus === "coverage_gap") {
    issues.push(issue("versioned_final_checklist_reconciliation_coverage_gap", { objective: row.id }));
  }
  if (
    row.finalStatus === "code_only_complete" &&
    Number(row.uncoveredScannerRowCount ?? 0) +
      Number(row.missingValidationCommandCount ?? 0) +
      Number(row.pendingSafeActionCount ?? 0) +
      Number(row.missingMetadataCount ?? 0) >
      0
  ) {
    issues.push(
      issue("versioned_final_checklist_reconciliation_complete_with_unresolved_rows", {
        objective: row.id,
        uncoveredScannerRowCount: row.uncoveredScannerRowCount,
        missingValidationCommandCount: row.missingValidationCommandCount,
        pendingSafeActionCount: row.pendingSafeActionCount,
        missingMetadataCount: row.missingMetadataCount,
      }),
    );
  }
  return issues;
}

export function buildVersionedFinalChecklistReconciliation(root = DEFAULT_ROOT, options = {}) {
  const sources = options.sources ?? defaultSources(root);
  const objectives = OBJECTIVE_TAXONOMY.map((taxonomy) => buildObjective(taxonomy, sources)).sort((a, b) => a.id.localeCompare(b.id));
  const statusCounts = {};
  for (const objective of objectives) {
    statusCounts[objective.finalStatus] = (statusCounts[objective.finalStatus] ?? 0) + 1;
  }
  const issues = [
    ...sourceIssueSummaries(sources),
    ...objectives.flatMap(validateObjective),
  ];

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-final-checklist-reconciliation.mjs --write",
    policy:
      "Classify remaining checklist families from code-owned closure/readiness artifacts, queues, allowlists, SQL staging, public runtime readiness, and package-script readiness. Checklist docs are not configuration.",
    sourceArtifacts: {
      versionedCodeOnlyClosure: "artifacts/compatibility/versioned-code-only-closure.json",
      versionedUncheckedObjectiveReadiness: "artifacts/compatibility/versioned-unchecked-objective-readiness.json",
      versionedForwardMigrationReadiness: "artifacts/compatibility/versioned-forward-migration-readiness.json",
      sqlPolicyPredicateEquivalence: "artifacts/supabase/sql-policy-predicate-equivalence.json",
      sqlPolicyForwardMigrationBlueprint: "artifacts/supabase/sql-policy-forward-migration-blueprint.json",
      versionedPublicRuntimeDualRead: "artifacts/compatibility/versioned-public-runtime-dual-read.json",
      versionedPackageScriptReadiness: "artifacts/compatibility/versioned-package-script-readiness.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
    },
    totals: {
      objectiveCount: objectives.length,
      statusCounts: sortedObject(statusCounts),
      codeOnlyCompleteCount: statusCounts.code_only_complete ?? 0,
      retainedLegacyBlockedCount: statusCounts.retained_legacy_blocked ?? 0,
      requiresForwardMigrationCount: statusCounts.requires_forward_migration ?? 0,
      requiresExternalOrProductionCutoverCount: statusCounts.requires_external_or_production_cutover ?? 0,
      finalZeroBlockedCount: statusCounts.final_zero_blocked ?? 0,
      uncoveredScannerRowCount: objectives.reduce((sum, row) => sum + Number(row.uncoveredScannerRowCount ?? 0), 0),
      missingValidationCommandCount: objectives.reduce((sum, row) => sum + Number(row.missingValidationCommandCount ?? 0), 0),
      pendingSafeActionCount: objectives.reduce((sum, row) => sum + Number(row.pendingSafeActionCount ?? 0), 0),
      missingMetadataCount: objectives.reduce((sum, row) => sum + Number(row.missingMetadataCount ?? 0), 0),
      sourceIssueCount: sourceIssueSummaries(sources).length,
      issueCount: issues.length,
    },
    objectives,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedFinalChecklistReconciliation(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedFinalChecklistReconciliation(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push(issue("versioned_final_checklist_reconciliation_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push(
      issue("versioned_final_checklist_reconciliation_drift", {
        path: artifactRel,
        hint: "Run npm run write:versioned-final-checklist-reconciliation",
      }),
    );
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    objectiveCount: current.totals.objectiveCount,
    statusCounts: current.totals.statusCounts,
    pendingSafeActionCount: current.totals.pendingSafeActionCount,
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

export function runVersionedFinalChecklistReconciliation(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildVersionedFinalChecklistReconciliation(options.root, options);
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

  const report = analyzeVersionedFinalChecklistReconciliation(options);
  const { current: _current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedFinalChecklistReconciliation();
}
