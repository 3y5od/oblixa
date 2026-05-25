#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { analyzeVersionedAliasUsageNeutrality } from "./check-versioned-alias-usage-neutrality.mjs";
import { analyzeVersionedCompatibilityEquivalence } from "./check-versioned-compatibility-equivalence.mjs";
import { analyzeVersionedEnvFlagAliases } from "./check-versioned-env-flag-aliases.mjs";
import { analyzeVersionedExportedSymbols } from "./check-versioned-exported-symbols.mjs";
import { analyzeVersionedExportedSymbolAliases } from "./check-versioned-exported-symbol-aliases.mjs";
import { analyzeVersionedLocalContentRewrites } from "./check-versioned-local-content-rewrites.mjs";
import { analyzeVersionedNamingSafeRenames } from "./check-versioned-naming-safe-renames.mjs";
import { analyzeVersionedOpenObjectiveClosure } from "./check-versioned-open-objective-closure.mjs";
import { analyzeVersionedPackageScriptReadiness } from "./check-versioned-package-script-readiness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-code-only-closure.json";

const OPEN_STATUS_MAP = {
  coverage_proven: "coverage_proven",
  retained_legacy_blocked: "retained_legacy_blocked",
  requires_runtime_alias: "requires_runtime_alias",
  requires_production_or_external_cutover: "requires_external_or_production_cutover",
};

const SQL_FORWARD_OBJECTIVE_IDS = new Set(["sql_security_and_seed_staging"]);

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

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function defaultSourceReports(root) {
  return {
    safeRenames: analyzeVersionedNamingSafeRenames({ root }),
    exportedSymbols: analyzeVersionedExportedSymbols({ root }),
    exportedSymbolAliases: analyzeVersionedExportedSymbolAliases({ root }),
    localContentRewrites: analyzeVersionedLocalContentRewrites({ root }),
    packageScriptReadiness: analyzeVersionedPackageScriptReadiness({ root }),
    aliasUsageNeutrality: analyzeVersionedAliasUsageNeutrality({ root }),
    envFlagAliases: analyzeVersionedEnvFlagAliases({ root }),
    openObjectiveClosure: analyzeVersionedOpenObjectiveClosure({ root }),
    compatibilityEquivalence: analyzeVersionedCompatibilityEquivalence({ root }),
    compatibilityRemovalQueue: analyzeCompatibilityRemovalQueue({ root }),
  };
}

function sourceIssueSummaries(sources) {
  return [
    ["versioned_naming_safe_renames", sources.safeRenames],
    ["versioned_exported_symbols", sources.exportedSymbols],
    ["versioned_exported_symbol_aliases", sources.exportedSymbolAliases],
    ["versioned_local_content_rewrites", sources.localContentRewrites],
    ["versioned_package_script_readiness", sources.packageScriptReadiness],
    ["versioned_alias_usage_neutrality", sources.aliasUsageNeutrality],
    ["versioned_env_flag_aliases", sources.envFlagAliases],
    ["versioned_open_objective_closure", sources.openObjectiveClosure],
    ["versioned_compatibility_equivalence", sources.compatibilityEquivalence],
    ["compatibility_removal_queue", sources.compatibilityRemovalQueue],
  ].flatMap(([source, report]) => {
    const issues = report?.issues ?? [];
    if (issues.length === 0 && report?.issueCount === 0) return [];
    return [
      issue("versioned_code_only_closure_source_issues", {
        source,
        issueCount: Number(report?.issueCount ?? issues.length),
        sampleIssues: issues.slice(0, 5),
      }),
    ];
  });
}

function safeActionGates(sources) {
  const safeRenames = sources.safeRenames ?? {};
  const exportedSymbolAliases = sources.exportedSymbolAliases ?? {};
  const localContentRewrites = sources.localContentRewrites ?? {};
  const packageScriptReadiness = sources.packageScriptReadiness ?? {};
  const aliasUsageNeutrality = sources.aliasUsageNeutrality ?? {};
  const envFlagAliases = sources.envFlagAliases ?? {};

  return [
    {
      id: "path_level_safe_renames",
      owner: "platform-hardening",
      validationCommand: "npm run check:versioned-naming-safe-renames",
      safeActionStatus: Number(safeRenames.pendingRenameCount ?? 0) === 0 ? "exhausted" : "pending",
      pendingSafeActionCount: Number(safeRenames.pendingRenameCount ?? 0),
      completedActionCount: Number(safeRenames.appliedRenameCount ?? 0),
      reason: "All manifest-approved local path renames must be applied before closure can be claimed.",
    },
    {
      id: "exported_symbol_aliases",
      owner: "platform-hardening",
      validationCommand: "npm run check:versioned-exported-symbol-aliases",
      safeActionStatus:
        Number(exportedSymbolAliases.pendingAliasCount ?? 0) + Number(exportedSymbolAliases.blockedAliasCount ?? 0) === 0
          ? "exhausted"
          : "pending",
      pendingSafeActionCount:
        Number(exportedSymbolAliases.pendingAliasCount ?? 0) + Number(exportedSymbolAliases.blockedAliasCount ?? 0),
      completedActionCount: Number(sources.exportedSymbols?.aliasAddedCount ?? 0),
      reason: "All non-manual exported-symbol aliases must be added or intentionally queued.",
    },
    {
      id: "local_content_rewrites",
      owner: "platform-hardening",
      validationCommand: "npm run check:versioned-local-content-rewrites",
      safeActionStatus: Number(localContentRewrites.pendingRewriteCount ?? 0) === 0 ? "exhausted" : "pending",
      pendingSafeActionCount: Number(localContentRewrites.pendingRewriteCount ?? 0),
      completedActionCount: 0,
      reason: "All manifest-proven local content rewrites must be applied before closure can be claimed.",
    },
    {
      id: "package_script_alias_readiness",
      owner: "platform-hardening",
      validationCommand: "npm run check:versioned-package-script-readiness",
      safeActionStatus: Number(packageScriptReadiness.blockingReferenceCount ?? 0) === 0 ? "exhausted" : "pending",
      pendingSafeActionCount: Number(packageScriptReadiness.blockingReferenceCount ?? 0),
      completedActionCount: Number(packageScriptReadiness.localReadyForRemovalCount ?? 0),
      reason: "Repo-local references to retained package-script aliases must stay neutral while aliases remain callable.",
    },
    {
      id: "alias_usage_neutrality",
      owner: "platform-hardening",
      validationCommand: "npm run check:versioned-alias-usage-neutrality",
      safeActionStatus: Number(aliasUsageNeutrality.issueCount ?? 0) === 0 ? "exhausted" : "pending",
      pendingSafeActionCount: Number(aliasUsageNeutrality.issueCount ?? 0),
      completedActionCount: Number(aliasUsageNeutrality.retainedLegacyAliasCount ?? 0),
      reason: "Retained compatibility aliases must be queue-covered and repo-local callers should prefer neutral names.",
    },
    {
      id: "env_feature_flag_aliases",
      owner: "platform-hardening",
      validationCommand: "npm run check:versioned-env-flag-aliases",
      safeActionStatus: Number(envFlagAliases.issueCount ?? 0) === 0 ? "exhausted" : "pending",
      pendingSafeActionCount: Number(envFlagAliases.issueCount ?? 0),
      completedActionCount: Number(envFlagAliases.aliasCount ?? 0),
      reason: "Versioned feature-flag env keys need neutral-first, legacy-second aliases and queue coverage.",
    },
  ];
}

function normalizeOpenObjectiveStatus(row) {
  if (SQL_FORWARD_OBJECTIVE_IDS.has(row.id)) return "requires_forward_migration";
  return OPEN_STATUS_MAP[row.coverageStatus] ?? "coverage_gap";
}

function openObjectivesFrom(report) {
  return report?.current?.objectives ?? report?.objectives ?? [];
}

function closureObjectives(sources) {
  return openObjectivesFrom(sources.openObjectiveClosure)
    .map((row) => ({
      id: row.id,
      owner: row.owner,
      reason: row.reason,
      validationCommand: row.validationCommand,
      manualFollowUp: row.manualFollowUp,
      closureStatus: normalizeOpenObjectiveStatus(row),
      sourceCoverageStatus: row.coverageStatus,
      queueNames: row.queueNames ?? [],
      queueCounts: row.queueCounts ?? {},
      uncoveredManualCount: Number(row.uncoveredManualCount ?? 0),
      remainingSafeActionCount: Number(row.remainingSafeActionCount ?? 0),
      missingMetadataCount: Number(row.missingMetadataCount ?? 0),
      missingValidationCommandCount: Number(row.missingValidationCommandCount ?? 0),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function validateClosureObjective(row) {
  const issues = [];
  for (const key of ["owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("versioned_code_only_closure_missing_objective_metadata", { objective: row.id, key }));
    }
  }
  if (row.closureStatus === "coverage_gap") {
    issues.push(issue("versioned_code_only_closure_unmapped_objective_status", { objective: row.id, sourceCoverageStatus: row.sourceCoverageStatus }));
  }
  if (row.uncoveredManualCount > 0) {
    issues.push(issue("versioned_code_only_closure_uncovered_manual_rows", { objective: row.id, count: row.uncoveredManualCount }));
  }
  if (row.remainingSafeActionCount > 0) {
    issues.push(issue("versioned_code_only_closure_pending_safe_actions", { objective: row.id, count: row.remainingSafeActionCount }));
  }
  if (row.missingMetadataCount > 0) {
    issues.push(issue("versioned_code_only_closure_missing_row_metadata", { objective: row.id, count: row.missingMetadataCount }));
  }
  if (row.missingValidationCommandCount > 0) {
    issues.push(issue("versioned_code_only_closure_missing_validation_commands", { objective: row.id, count: row.missingValidationCommandCount }));
  }
  return issues;
}

function validateSafeActionGate(row) {
  if (row.pendingSafeActionCount === 0) return [];
  return [
    issue("versioned_code_only_closure_pending_safe_action_gate", {
      gate: row.id,
      count: row.pendingSafeActionCount,
      validationCommand: row.validationCommand,
    }),
  ];
}

export function buildVersionedCodeOnlyClosure(root = DEFAULT_ROOT, options = {}) {
  const sources = options.sources ?? defaultSourceReports(root);
  const gates = safeActionGates(sources);
  const objectives = closureObjectives(sources);
  const statusCounts = {};
  for (const objective of objectives) {
    statusCounts[objective.closureStatus] = (statusCounts[objective.closureStatus] ?? 0) + 1;
  }

  const issues = [
    ...sourceIssueSummaries(sources),
    ...gates.flatMap(validateSafeActionGate),
    ...objectives.flatMap(validateClosureObjective),
  ];
  const pendingSafeActionCount =
    gates.reduce((sum, row) => sum + row.pendingSafeActionCount, 0) +
    objectives.reduce((sum, row) => sum + row.remainingSafeActionCount, 0);

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-code-only-closure.mjs --write",
    policy:
      "Prove remaining version-name work is code-only complete, queued, allowlisted, or blocked by explicit manual/production compatibility boundaries. Checklist docs are not configuration.",
    sourceArtifacts: {
      versionedNamingSafeRenameManifest: "artifacts/compatibility/versioned-naming-safe-rename-manifest.json",
      versionedExportedSymbolInventory: "artifacts/compatibility/versioned-exported-symbol-inventory.json",
      versionedLocalContentRewriteManifest: "artifacts/compatibility/versioned-local-content-rewrite-manifest.json",
      versionedPackageScriptReadiness: "artifacts/compatibility/versioned-package-script-readiness.json",
      versionedAliasUsageNeutrality: "artifacts/compatibility/versioned-alias-usage-neutrality.json",
      versionedEnvFlagAliases: "artifacts/compatibility/versioned-env-flag-aliases.json",
      versionedOpenObjectiveClosure: "artifacts/compatibility/versioned-open-objective-closure.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
    },
    totals: {
      objectiveCount: objectives.length,
      statusCounts: sortedObject(statusCounts),
      safeActionGateCount: gates.length,
      pendingSafeActionCount,
      retainedLegacyAliasCount: Number(sources.aliasUsageNeutrality?.retainedLegacyAliasCount ?? 0),
      envFlagAliasCount: Number(sources.envFlagAliases?.aliasCount ?? 0),
      packageScriptAliasCount: Number(sources.packageScriptReadiness?.aliasCount ?? 0),
      packageScriptReadyForRemovalCount: Number(sources.packageScriptReadiness?.readyForRemovalCount ?? 0),
      packageScriptLocalReadyForRemovalCount: Number(sources.packageScriptReadiness?.localReadyForRemovalCount ?? 0),
      sourceIssueCount: sourceIssueSummaries(sources).length,
      issueCount: issues.length,
    },
    safeActionGates: gates,
    objectives,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedCodeOnlyClosure(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedCodeOnlyClosure(root, options);
  const issues = [...current.issues];
  const committed = readJson(root, artifactRel, null);
  if (!committed) {
    issues.push(issue("versioned_code_only_closure_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(committed) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
    issues.push(issue("versioned_code_only_closure_drift", { path: artifactRel, hint: "Run npm run write:versioned-code-only-closure" }));
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    objectiveCount: current.totals.objectiveCount,
    statusCounts: current.totals.statusCounts,
    pendingSafeActionCount: current.totals.pendingSafeActionCount,
    retainedLegacyAliasCount: current.totals.retainedLegacyAliasCount,
    packageScriptReadyForRemovalCount: current.totals.packageScriptReadyForRemovalCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedCodeOnlyClosure(root);
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

export function runVersionedCodeOnlyClosure(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          objectiveCount: artifact.totals.objectiveCount,
          statusCounts: artifact.totals.statusCounts,
          pendingSafeActionCount: artifact.totals.pendingSafeActionCount,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeVersionedCodeOnlyClosure(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedCodeOnlyClosure();
}
