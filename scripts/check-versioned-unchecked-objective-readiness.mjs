#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { analyzeSeedVersionedNameQueueCoverage } from "./check-seed-versioned-name-queue-coverage.mjs";
import { analyzeSqlObjectRenameStaging } from "./check-sql-object-rename-staging.mjs";
import { analyzeSqlSecurityAutomationCoverage } from "./check-sql-security-automation-coverage.mjs";
import { analyzeVersionedAdditiveAliasPreservation } from "./check-versioned-additive-alias-preservation.mjs";
import { analyzeVersionedAliasUsageNeutrality } from "./check-versioned-alias-usage-neutrality.mjs";
import { analyzeVersionedCodeOnlyClosure } from "./check-versioned-code-only-closure.mjs";
import { analyzeVersionedCompatibilityEquivalence } from "./check-versioned-compatibility-equivalence.mjs";
import { analyzeVersionedEnvFlagAliases } from "./check-versioned-env-flag-aliases.mjs";
import { analyzeVersionedLocalSurfaceRegression } from "./check-versioned-local-surface-regression.mjs";
import { analyzeVersionedPackageScriptReadiness } from "./check-versioned-package-script-readiness.mjs";
import { analyzeVersionedPublicContractPreservation } from "./check-versioned-public-contract-preservation.mjs";
import { analyzeVersionedPublicRuntimeDualRead } from "./check-versioned-public-runtime-dual-read.mjs";
import { analyzeVersionedRemainingLocalContractClosure } from "./check-versioned-remaining-local-contract-closure.mjs";
import { analyzeVersionedSourceConfigPreservation } from "./check-versioned-source-config-preservation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-unchecked-objective-readiness.json";

const READINESS_STATUSES = new Set([
  "implemented",
  "queue_covered",
  "alias_ready",
  "requires_runtime_dual_read",
  "requires_forward_migration",
  "requires_external_or_production_cutover",
  "coverage_gap",
]);

const OBJECTIVE_TAXONOMY = [
  {
    id: "safe_action_exhaustion",
    owner: "platform-hardening",
    reason: "Path renames, exported-symbol aliases, local content rewrites, env aliases, and alias-usage rewrites must stay exhausted before unchecked code-only items can be marked complete.",
    validationCommand: "npm run check:versioned-code-only-closure",
    manualFollowUp: "Apply any newly discovered safe action through its owning explicit write command before marking further checklist items complete.",
    sourceReports: ["versionedCodeOnlyClosure"],
    classifier: classifySafeActionExhaustion,
  },
  {
    id: "package_script_alias_readiness",
    owner: "platform-hardening",
    reason: "Legacy package-script aliases stay callable, but repo-local usage must prefer neutral commands and readiness evidence must remain deterministic.",
    validationCommand: "npm run check:versioned-package-script-readiness",
    manualFollowUp: "Remove retained legacy package scripts only after all aliases report ready_for_removal and removal is explicitly in scope.",
    sourceReports: ["versionedPackageScriptReadiness", "compatibilityRemovalQueue"],
    queueNames: ["packageScriptAliases"],
    classifier: classifyPackageScriptReadiness,
  },
  {
    id: "compatibility_alias_equivalence",
    owner: "platform-hardening",
    reason: "Retained old and neutral aliases must remain equivalent for packages, exports, env flags, telemetry, routes, selectors, and SQL staging metadata.",
    validationCommand: "npm run check:versioned-compatibility-equivalence",
    manualFollowUp: "Keep old aliases until their compatibility queue rows are ready for removal and downstream references have migrated.",
    sourceReports: [
      "versionedCompatibilityEquivalence",
      "versionedAliasUsageNeutrality",
      "versionedAdditiveAliasPreservation",
      "versionedEnvFlagAliases",
      "compatibilityRemovalQueue",
    ],
    queueNames: ["packageScriptAliases", "exportedSymbolAliases", "telemetryEventNames", "environmentKeys", "apiRoutes", "cronRoutes", "sqlObjects"],
    classifier: classifyCompatibilityAliasEquivalence,
  },
  {
    id: "env_feature_flag_dual_read",
    owner: "platform-hardening",
    reason: "Repo-owned versioned env and feature-flag keys need neutral-first, legacy-second dual reads without changing production values.",
    validationCommand: "npm run check:versioned-env-flag-aliases",
    manualFollowUp: "Keep legacy env keys accepted until production configuration and external runbooks explicitly cut over to neutral names.",
    sourceReports: ["versionedEnvFlagAliases", "compatibilityRemovalQueue"],
    queueNames: ["environmentKeys"],
    classifier: classifyEnvFeatureFlagDualRead,
  },
  {
    id: "remaining_local_surface_contracts",
    owner: "platform-hardening",
    reason: "Local text, fixtures, selectors, style tokens, copy keys, QA registries, and source-owned config IDs must be classified, queued, allowlisted, or regression-guarded.",
    validationCommand: "npm run check:versioned-remaining-local-contract-closure",
    manualFollowUp: "Rewrite only scanner-proven local references; retain historical evidence and standards/provider/schema versions.",
    sourceReports: [
      "versionedRemainingLocalContractClosure",
      "versionedLocalSurfaceRegression",
      "versionedSourceConfigPreservation",
      "versionedAdditiveAliasPreservation",
    ],
    queueNames: ["contentContractAliases"],
    classifier: classifyRemainingLocalSurfaceContracts,
  },
  {
    id: "public_metadata_pwa_routes",
    owner: "frontend-platform",
    reason: "Public metadata, PWA, well-known, OpenAPI, route, cron, and deep-link names require runtime aliases or external consumer cutover before legacy names can be removed.",
    validationCommand: "npm run check:versioned-public-runtime-dual-read",
    manualFollowUp: "Leave public-name removals unchecked until old and neutral contracts are both validated and consumer cutover evidence exists.",
    sourceReports: ["versionedPublicContractPreservation", "versionedPublicRuntimeDualRead", "compatibilityRemovalQueue"],
    queueNames: ["apiRoutes", "cronRoutes", "contentContractAliases"],
    classifier: classifyPublicMetadataPwaRoutes,
  },
  {
    id: "sql_security_seed_forward_migration",
    owner: "database-platform",
    reason: "SQL object names, RLS/security automation, and seed payload keys require forward migrations, staging metadata, and linked verification before removal.",
    validationCommand: "npm run check:sql-object-rename-staging",
    manualFollowUp: "Do not remove SQL legacy names or migration evidence without forward aliases and linked production catalog verification.",
    sourceReports: ["sqlObjectRenameStaging", "sqlSecurityAutomationCoverage", "seedVersionedNameQueueCoverage", "compatibilityRemovalQueue"],
    queueNames: ["sqlObjects", "sqlSecurityAutomation", "migrationHistoryFilenames", "seedVersionedNames"],
    classifier: classifySqlSecuritySeedForwardMigration,
  },
  {
    id: "telemetry_observability_external_cutover",
    owner: "platform",
    reason: "Persisted telemetry, observability, audit, diagnostic, provider, and external integration names require dashboard or external consumer cutover before removal.",
    validationCommand: "npm run check:versioned-compatibility-equivalence",
    manualFollowUp: "Keep persisted telemetry and provider-facing names until dashboards, consumers, and provider contracts have explicit cutover evidence.",
    sourceReports: ["versionedCompatibilityEquivalence", "compatibilityRemovalQueue"],
    queueNames: ["telemetryEventNames", "contentContractAliases"],
    classifier: classifyTelemetryObservabilityExternalCutover,
  },
  {
    id: "final_zero_version_enforcement",
    owner: "platform-hardening",
    reason: "Final zero-version enforcement remains blocked by retained compatibility names, production cutover evidence, and public/runtime legacy contracts.",
    validationCommand: "npm run check:versioned-naming",
    manualFollowUp: "Keep final zero-version enforcement unchecked until all retained queues are ready_for_removal and production/external cutover is complete.",
    sourceReports: ["versionedCodeOnlyClosure", "compatibilityRemovalQueue"],
    queueNames: [
      "packageScriptAliases",
      "telemetryEventNames",
      "apiRoutes",
      "cronRoutes",
      "environmentKeys",
      "sqlObjects",
      "contentContractAliases",
    ],
    classifier: classifyFinalZeroVersionEnforcement,
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
    versionedCodeOnlyClosure: analyzeVersionedCodeOnlyClosure({ root }),
    versionedRemainingLocalContractClosure: analyzeVersionedRemainingLocalContractClosure({ root }),
    versionedAdditiveAliasPreservation: analyzeVersionedAdditiveAliasPreservation({ root }),
    versionedPackageScriptReadiness: analyzeVersionedPackageScriptReadiness({ root }),
    versionedCompatibilityEquivalence: analyzeVersionedCompatibilityEquivalence({ root }),
    versionedAliasUsageNeutrality: analyzeVersionedAliasUsageNeutrality({ root }),
    versionedEnvFlagAliases: analyzeVersionedEnvFlagAliases({ root }),
    versionedPublicContractPreservation: analyzeVersionedPublicContractPreservation({ root }),
    versionedPublicRuntimeDualRead: analyzeVersionedPublicRuntimeDualRead({ root }),
    versionedSourceConfigPreservation: analyzeVersionedSourceConfigPreservation({ root }),
    versionedLocalSurfaceRegression: analyzeVersionedLocalSurfaceRegression({ root }),
    compatibilityRemovalQueue: analyzeCompatibilityRemovalQueue({ root }),
    sqlObjectRenameStaging: analyzeSqlObjectRenameStaging({ root }),
    sqlSecurityAutomationCoverage: analyzeSqlSecurityAutomationCoverage({ root }),
    seedVersionedNameQueueCoverage: analyzeSeedVersionedNameQueueCoverage({ root }),
  };
}

function reportIssueCount(report) {
  return Number(report?.issueCount ?? report?.issues?.length ?? 0);
}

function sourceIssueSummaries(sources) {
  return [
    ["versioned_code_only_closure", sources.versionedCodeOnlyClosure],
    ["versioned_remaining_local_contract_closure", sources.versionedRemainingLocalContractClosure],
    ["versioned_additive_alias_preservation", sources.versionedAdditiveAliasPreservation],
    ["versioned_package_script_readiness", sources.versionedPackageScriptReadiness],
    ["versioned_compatibility_equivalence", sources.versionedCompatibilityEquivalence],
    ["versioned_alias_usage_neutrality", sources.versionedAliasUsageNeutrality],
    ["versioned_env_flag_aliases", sources.versionedEnvFlagAliases],
    ["versioned_public_contract_preservation", sources.versionedPublicContractPreservation],
    ["versioned_public_runtime_dual_read", sources.versionedPublicRuntimeDualRead],
    ["versioned_source_config_preservation", sources.versionedSourceConfigPreservation],
    ["versioned_local_surface_regression", sources.versionedLocalSurfaceRegression],
    ["compatibility_removal_queue", sources.compatibilityRemovalQueue],
    ["sql_object_rename_staging", sources.sqlObjectRenameStaging],
    ["sql_security_automation_coverage", sources.sqlSecurityAutomationCoverage],
    ["seed_versioned_name_queue_coverage", sources.seedVersionedNameQueueCoverage],
  ].flatMap(([source, report]) => {
    const issues = report?.issues ?? [];
    const issueCount = reportIssueCount(report);
    if (issueCount === 0) return [];
    return [
      issue("versioned_unchecked_objective_readiness_source_issues", {
        source,
        issueCount,
        sampleIssues: issues.slice(0, 5),
      }),
    ];
  });
}

function sourceOk(sources, names) {
  return names.every((name) => reportIssueCount(sources[name]) === 0);
}

function sumObjectiveField(report, field) {
  const objectives = report?.current?.objectives ?? report?.objectives ?? [];
  return objectives.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

function sumGroupField(report, field) {
  const groups = report?.current?.groups ?? report?.groups ?? [];
  return groups.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

function queueCountsFor(sources, queueNames = []) {
  const queues = sources.compatibilityRemovalQueue?.current?.queues ?? sources.compatibilityRemovalQueue?.queues ?? {};
  return sortedObject(
    Object.fromEntries(
      queueNames.map((queueName) => [queueName, Array.isArray(queues[queueName]) ? queues[queueName].length : 0]),
    ),
  );
}

function metadataCounts(...reports) {
  return {
    uncoveredManualCount: reports.reduce(
      (sum, report) =>
        sum +
        Number(report?.uncoveredManualCount ?? report?.current?.totals?.uncoveredManualCount ?? 0) +
        sumObjectiveField(report, "uncoveredManualCount") +
        sumGroupField(report, "uncoveredManualCount"),
      0,
    ),
    remainingSafeActionCount: reports.reduce(
      (sum, report) =>
        sum +
        Number(report?.remainingSafeActionCount ?? report?.pendingSafeActionCount ?? report?.current?.totals?.remainingSafeActionCount ?? 0) +
        sumObjectiveField(report, "remainingSafeActionCount") +
        sumGroupField(report, "remainingSafeActionCount"),
      0,
    ),
    missingMetadataCount: reports.reduce(
      (sum, report) =>
        sum +
        Number(report?.missingMetadataCount ?? report?.current?.totals?.missingMetadataCount ?? 0) +
        sumObjectiveField(report, "missingMetadataCount") +
        sumGroupField(report, "missingMetadataCount"),
      0,
    ),
    missingValidationCommandCount: reports.reduce(
      (sum, report) =>
        sum +
        Number(report?.missingValidationCommandCount ?? report?.current?.totals?.missingValidationCommandCount ?? 0) +
        sumObjectiveField(report, "missingValidationCommandCount") +
        sumGroupField(report, "missingValidationCommandCount"),
      0,
    ),
  };
}

function classifySafeActionExhaustion(sources) {
  const report = sources.versionedCodeOnlyClosure ?? {};
  const pendingSafeActionCount = Number(report.pendingSafeActionCount ?? report.current?.totals?.pendingSafeActionCount ?? 0);
  return {
    readinessStatus: sourceOk(sources, ["versionedCodeOnlyClosure"]) && pendingSafeActionCount === 0 ? "implemented" : "coverage_gap",
    evidence: {
      pendingSafeActionCount,
      statusCounts: report.statusCounts ?? report.current?.totals?.statusCounts ?? {},
      safeActionGateCount: Number(report.current?.totals?.safeActionGateCount ?? 0),
    },
    counts: {
      uncoveredManualCount: 0,
      remainingSafeActionCount: pendingSafeActionCount,
      missingMetadataCount: 0,
      missingValidationCommandCount: 0,
    },
  };
}

function classifyPackageScriptReadiness(sources) {
  const report = sources.versionedPackageScriptReadiness ?? {};
  const aliasCount = Number(report.aliasCount ?? report.current?.aliasCount ?? 0);
  const localReadyForRemovalCount = Number(report.localReadyForRemovalCount ?? report.current?.localReadyForRemovalCount ?? 0);
  const readyForRemovalCount = Number(report.readyForRemovalCount ?? report.current?.readyForRemovalCount ?? 0);
  const blockingReferenceCount = Number(report.blockingReferenceCount ?? report.current?.blockingReferenceCount ?? 0);
  const readinessStatus =
    sourceOk(sources, ["versionedPackageScriptReadiness", "compatibilityRemovalQueue"]) &&
    aliasCount > 0 &&
    localReadyForRemovalCount === aliasCount &&
    blockingReferenceCount === 0
      ? "alias_ready"
      : sourceOk(sources, ["versionedPackageScriptReadiness", "compatibilityRemovalQueue"])
        ? "queue_covered"
        : "coverage_gap";
  return {
    readinessStatus,
    evidence: {
      aliasCount,
      localReadyForRemovalCount,
      readyForRemovalCount,
      blockedAliasCount: Number(report.blockedAliasCount ?? report.current?.blockedAliasCount ?? 0),
      blockingReferenceCount,
    },
    counts: {
      uncoveredManualCount: 0,
      remainingSafeActionCount: blockingReferenceCount,
      missingMetadataCount: 0,
      missingValidationCommandCount: 0,
    },
  };
}

function classifyCompatibilityAliasEquivalence(sources) {
  const reports = [
    sources.versionedCompatibilityEquivalence,
    sources.versionedAliasUsageNeutrality,
    sources.versionedAdditiveAliasPreservation,
    sources.versionedEnvFlagAliases,
    sources.compatibilityRemovalQueue,
  ];
  const counts = metadataCounts(...reports);
  return {
    readinessStatus:
      sourceOk(sources, [
        "versionedCompatibilityEquivalence",
        "versionedAliasUsageNeutrality",
        "versionedAdditiveAliasPreservation",
        "versionedEnvFlagAliases",
        "compatibilityRemovalQueue",
      ]) && counts.remainingSafeActionCount === 0
        ? "implemented"
        : "coverage_gap",
    evidence: {
      retainedLegacyAliasCount: Number(sources.versionedAliasUsageNeutrality?.retainedLegacyAliasCount ?? 0),
      domAliasPairCount: Number(sources.versionedAdditiveAliasPreservation?.domAliasPairCount ?? 0),
      coveredDomAliasPairCount: Number(sources.versionedAdditiveAliasPreservation?.coveredDomAliasPairCount ?? 0),
      envAliasCount: Number(sources.versionedEnvFlagAliases?.aliasCount ?? 0),
    },
    counts,
  };
}

function classifyEnvFeatureFlagDualRead(sources) {
  const report = sources.versionedEnvFlagAliases ?? {};
  const aliasCount = Number(report.aliasCount ?? report.current?.aliasCount ?? 0);
  const counts = metadataCounts(report);
  return {
    readinessStatus: sourceOk(sources, ["versionedEnvFlagAliases", "compatibilityRemovalQueue"]) && aliasCount > 0 ? "implemented" : "coverage_gap",
    evidence: {
      aliasCount,
      precedence: "neutral_first_legacy_second",
    },
    counts,
  };
}

function classifyRemainingLocalSurfaceContracts(sources) {
  const reports = [
    sources.versionedRemainingLocalContractClosure,
    sources.versionedLocalSurfaceRegression,
    sources.versionedSourceConfigPreservation,
    sources.versionedAdditiveAliasPreservation,
  ];
  const counts = metadataCounts(...reports);
  return {
    readinessStatus:
      sourceOk(sources, [
        "versionedRemainingLocalContractClosure",
        "versionedLocalSurfaceRegression",
        "versionedSourceConfigPreservation",
        "versionedAdditiveAliasPreservation",
      ]) && counts.remainingSafeActionCount + counts.uncoveredManualCount + counts.missingMetadataCount + counts.missingValidationCommandCount === 0
        ? "implemented"
        : "coverage_gap",
    evidence: {
      localClosureStatusCounts: sources.versionedRemainingLocalContractClosure?.statusCounts ?? {},
      localRegressionGroupCount: Number(sources.versionedLocalSurfaceRegression?.groupCount ?? sources.versionedLocalSurfaceRegression?.current?.totals?.groupCount ?? 0),
      sourceConfigGroupCount: Number(sources.versionedSourceConfigPreservation?.groupCount ?? 0),
    },
    counts,
  };
}

function classifyPublicMetadataPwaRoutes(sources) {
  const reports = [sources.versionedPublicContractPreservation, sources.versionedPublicRuntimeDualRead, sources.compatibilityRemovalQueue];
  const counts = metadataCounts(...reports);
  const runtimeStatusCounts = sources.versionedPublicRuntimeDualRead?.statusCounts ?? sources.versionedPublicRuntimeDualRead?.current?.totals?.statusCounts ?? {};
  return {
    readinessStatus:
      sourceOk(sources, ["versionedPublicContractPreservation", "versionedPublicRuntimeDualRead", "compatibilityRemovalQueue"]) &&
      counts.uncoveredManualCount + counts.remainingSafeActionCount + counts.missingMetadataCount + counts.missingValidationCommandCount === 0
        ? "queue_covered"
        : "coverage_gap",
    evidence: {
      publicGroupCount: Number(sources.versionedPublicContractPreservation?.groupCount ?? 0),
      preservedGroupCount: Number(sources.versionedPublicContractPreservation?.preservedGroupCount ?? 0),
      contractCount: Number(sources.versionedPublicContractPreservation?.contractCount ?? 0),
      dualReadPresentCount: Number(sources.versionedPublicRuntimeDualRead?.dualReadPresentCount ?? 0),
      runtimeReadinessStatusCounts: runtimeStatusCounts,
    },
    counts,
  };
}

function classifySqlSecuritySeedForwardMigration(sources) {
  const reports = [
    sources.sqlObjectRenameStaging,
    sources.sqlSecurityAutomationCoverage,
    sources.seedVersionedNameQueueCoverage,
    sources.compatibilityRemovalQueue,
  ];
  const counts = metadataCounts(...reports);
  return {
    readinessStatus:
      sourceOk(sources, [
        "sqlObjectRenameStaging",
        "sqlSecurityAutomationCoverage",
        "seedVersionedNameQueueCoverage",
        "compatibilityRemovalQueue",
      ])
        ? "requires_forward_migration"
        : "coverage_gap",
    evidence: {
      stagedSqlRenameCount: Number(sources.sqlObjectRenameStaging?.stagedRenameCount ?? sources.sqlObjectRenameStaging?.current?.stagedRenameCount ?? 0),
      sqlSecurityCoverageCount: Number(sources.sqlSecurityAutomationCoverage?.coverageCount ?? sources.sqlSecurityAutomationCoverage?.current?.coverageCount ?? 0),
      seedQueueCoveredCount: Number(sources.seedVersionedNameQueueCoverage?.queueCoveredCount ?? 0),
    },
    counts,
  };
}

function classifyTelemetryObservabilityExternalCutover(sources) {
  const reports = [sources.versionedCompatibilityEquivalence, sources.compatibilityRemovalQueue];
  const counts = metadataCounts(...reports);
  return {
    readinessStatus: sourceOk(sources, ["versionedCompatibilityEquivalence", "compatibilityRemovalQueue"])
      ? "requires_external_or_production_cutover"
      : "coverage_gap",
    evidence: {
      telemetryEventCount: Number(sources.versionedCompatibilityEquivalence?.telemetry?.eventCount ?? 0),
      telemetryNeutralAliasCount: Number(sources.versionedCompatibilityEquivalence?.telemetry?.neutralAliasCount ?? 0),
      telemetryQueueCount: Number(sources.versionedCompatibilityEquivalence?.telemetry?.queueCount ?? 0),
    },
    counts,
  };
}

function classifyFinalZeroVersionEnforcement(sources) {
  const codeOnlyReport = sources.versionedCodeOnlyClosure ?? {};
  const pendingSafeActionCount = Number(codeOnlyReport.pendingSafeActionCount ?? codeOnlyReport.current?.totals?.pendingSafeActionCount ?? 0);
  return {
    readinessStatus:
      sourceOk(sources, ["versionedCodeOnlyClosure", "compatibilityRemovalQueue"]) && pendingSafeActionCount === 0
        ? "requires_external_or_production_cutover"
        : "coverage_gap",
    evidence: {
      currentVersionedNamingCommand: "npm run check:versioned-naming",
      pendingSafeActionCount,
      retainedLegacyAliasCount: Number(codeOnlyReport.retainedLegacyAliasCount ?? codeOnlyReport.current?.totals?.retainedLegacyAliasCount ?? 0),
      compatibilityQueueIssueCount: reportIssueCount(sources.compatibilityRemovalQueue),
    },
    counts: {
      uncoveredManualCount: 0,
      remainingSafeActionCount: pendingSafeActionCount,
      missingMetadataCount: 0,
      missingValidationCommandCount: 0,
    },
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
    readinessStatus: classified.readinessStatus,
    sourceReports: taxonomy.sourceReports,
    queueNames: taxonomy.queueNames ?? [],
    queueCounts: queueCountsFor(sources, taxonomy.queueNames ?? []),
    ...classified.counts,
    evidence: classified.evidence,
  };
}

function validateObjective(row) {
  const issues = [];
  for (const key of ["owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("versioned_unchecked_objective_readiness_missing_objective_metadata", { objective: row.id, key }));
    }
  }
  if (!READINESS_STATUSES.has(row.readinessStatus)) {
    issues.push(issue("versioned_unchecked_objective_readiness_unknown_status", { objective: row.id, readinessStatus: row.readinessStatus }));
  }
  if (row.readinessStatus === "coverage_gap") {
    issues.push(issue("versioned_unchecked_objective_readiness_coverage_gap", { objective: row.id, validationCommand: row.validationCommand }));
  }
  if (Number(row.uncoveredManualCount ?? 0) > 0) {
    issues.push(issue("versioned_unchecked_objective_readiness_uncovered_manual_rows", { objective: row.id, count: row.uncoveredManualCount }));
  }
  if (Number(row.remainingSafeActionCount ?? 0) > 0) {
    issues.push(issue("versioned_unchecked_objective_readiness_pending_safe_actions", { objective: row.id, count: row.remainingSafeActionCount }));
  }
  if (Number(row.missingMetadataCount ?? 0) > 0) {
    issues.push(issue("versioned_unchecked_objective_readiness_missing_row_metadata", { objective: row.id, count: row.missingMetadataCount }));
  }
  if (Number(row.missingValidationCommandCount ?? 0) > 0) {
    issues.push(issue("versioned_unchecked_objective_readiness_missing_validation_commands", { objective: row.id, count: row.missingValidationCommandCount }));
  }
  return issues;
}

export function buildVersionedUncheckedObjectiveReadiness(root = DEFAULT_ROOT, options = {}) {
  const sources = options.sources ?? defaultSourceReports(root);
  const objectives = OBJECTIVE_TAXONOMY.map((taxonomy) => buildObjective(taxonomy, sources)).sort((a, b) => a.id.localeCompare(b.id));
  const statusCounts = {};
  for (const objective of objectives) {
    statusCounts[objective.readinessStatus] = (statusCounts[objective.readinessStatus] ?? 0) + 1;
  }
  const issues = [
    ...sourceIssueSummaries(sources),
    ...objectives.flatMap(validateObjective),
  ];

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-unchecked-objective-readiness.mjs --write",
    policy:
      "Classify still-unchecked code-only version-name objective families from code-owned inventories, queues, allowlists, SQL staging, route/PWA checks, additive alias preservation, code-only closure, and local-surface regression artifacts. Checklist docs are not configuration.",
    sourceArtifacts: {
      versionedCodeOnlyClosure: "artifacts/compatibility/versioned-code-only-closure.json",
      versionedRemainingLocalContractClosure: "artifacts/compatibility/versioned-remaining-local-contract-closure.json",
      versionedAdditiveAliasPreservation: "artifacts/compatibility/versioned-additive-alias-preservation.json",
      versionedPackageScriptReadiness: "artifacts/compatibility/versioned-package-script-readiness.json",
      versionedAliasUsageNeutrality: "artifacts/compatibility/versioned-alias-usage-neutrality.json",
      versionedEnvFlagAliases: "artifacts/compatibility/versioned-env-flag-aliases.json",
      versionedPublicRuntimeDualRead: "artifacts/compatibility/versioned-public-runtime-dual-read.json",
      versionedLocalSurfaceRegression: "artifacts/compatibility/versioned-local-surface-regression.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
      sqlObjectRenameStaging: "artifacts/supabase/sql-object-rename-staging.json",
      sqlSecurityAutomationCoverage: "artifacts/supabase/sql-security-automation-coverage.json",
      seedVersionedNameQueueCoverage: "artifacts/supabase/seed-versioned-name-queue-coverage.json",
    },
    totals: {
      objectiveCount: objectives.length,
      statusCounts: sortedObject(statusCounts),
      implementedCount: statusCounts.implemented ?? 0,
      queueCoveredCount: statusCounts.queue_covered ?? 0,
      aliasReadyCount: statusCounts.alias_ready ?? 0,
      requiresRuntimeDualReadCount: statusCounts.requires_runtime_dual_read ?? 0,
      requiresForwardMigrationCount: statusCounts.requires_forward_migration ?? 0,
      requiresExternalOrProductionCutoverCount: statusCounts.requires_external_or_production_cutover ?? 0,
      uncoveredManualCount: objectives.reduce((sum, row) => sum + Number(row.uncoveredManualCount ?? 0), 0),
      remainingSafeActionCount: objectives.reduce((sum, row) => sum + Number(row.remainingSafeActionCount ?? 0), 0),
      missingMetadataCount: objectives.reduce((sum, row) => sum + Number(row.missingMetadataCount ?? 0), 0),
      missingValidationCommandCount: objectives.reduce((sum, row) => sum + Number(row.missingValidationCommandCount ?? 0), 0),
      issueCount: issues.length,
    },
    objectives,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedUncheckedObjectiveReadiness(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedUncheckedObjectiveReadiness(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push(issue("versioned_unchecked_objective_readiness_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(artifact) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
    issues.push(
      issue("versioned_unchecked_objective_readiness_drift", {
        path: artifactRel,
        hint: "Run npm run write:versioned-unchecked-objective-readiness",
      }),
    );
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    objectiveCount: current.totals.objectiveCount,
    statusCounts: current.totals.statusCounts,
    remainingSafeActionCount: current.totals.remainingSafeActionCount,
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

export function runVersionedUncheckedObjectiveReadiness(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildVersionedUncheckedObjectiveReadiness(options.root, options);
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

  const report = analyzeVersionedUncheckedObjectiveReadiness(options);
  const { current: _current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedUncheckedObjectiveReadiness();
}
