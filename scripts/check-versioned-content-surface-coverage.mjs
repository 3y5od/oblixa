#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-content-surface-coverage.json";
const CONTENT_CONTRACT_INVENTORY_REL = "artifacts/compatibility/versioned-content-contract-inventory.json";
const COMPATIBILITY_REMOVAL_QUEUE_REL = "artifacts/compatibility/removal-queue.json";
const VERSION_REFERENCE_ALLOWLIST_REL = "scripts/version-reference-allowlist.json";
const LOCAL_CONTENT_REWRITE_MANIFEST_REL = "artifacts/compatibility/versioned-local-content-rewrite-manifest.json";

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function sortedObjectFromCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function flattenQueueRows(queueArtifact) {
  const rows = [];
  for (const [queueName, queueRows] of Object.entries(queueArtifact?.queues ?? {})) {
    if (!Array.isArray(queueRows)) continue;
    for (const row of queueRows) rows.push({ ...row, queueName });
  }
  return rows;
}

function compileAllowlist(allowlistArtifact, issues) {
  return (allowlistArtifact?.entries ?? []).flatMap((entry, index) => {
    try {
      return [{ ...entry, regex: new RegExp(entry.pattern, "iu") }];
    } catch (error) {
      issues.push({
        issue: "versioned_content_surface_allowlist_invalid_regex",
        index,
        id: entry?.id ?? null,
        message: error.message,
      });
      return [];
    }
  });
}

function rowEvidenceText(row) {
  return [
    row.path,
    row.surfaceClass,
    row.subSurfaceClass,
    row.contractName,
    row.token,
  ]
    .filter(Boolean)
    .join("\n");
}

function queueCoversContract(row, queueRows) {
  return queueRows.some((queueRow) => {
    if (queueRow.legacyName !== row.contractName) return false;
    if (queueRow.sourcePath && row.path && queueRow.sourcePath === row.path) return true;
    if (queueRow.subSurface && queueRow.subSurface === row.subSurfaceClass) return true;
    if (queueRow.surface && (queueRow.surface === row.surfaceClass || queueRow.surface === row.subSurfaceClass)) return true;
    return false;
  });
}

function allowlistCoversContract(row, allowlistRows) {
  const evidence = rowEvidenceText(row);
  return allowlistRows.some((entry) => entry.regex.test(evidence));
}

function isDocumentationOnly(row) {
  return row.surfaceClass === "documentation_contract" || String(row.path ?? "").startsWith("docs/");
}

function validateContractRow(row, index) {
  const issues = [];
  for (const key of [
    "path",
    "surfaceClass",
    "subSurfaceClass",
    "contractName",
    "owner",
    "reason",
    "removalStrategy",
    "validationCommand",
    "manualFollowUp",
  ]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push({ issue: "versioned_content_surface_contract_missing_metadata", index, key, path: row.path ?? null });
    }
  }
  if (typeof row.manualOnly !== "boolean") {
    issues.push({ issue: "versioned_content_surface_contract_missing_manual_only", index, path: row.path ?? null });
  }
  if (!Object.prototype.hasOwnProperty.call(row, "suggestedNeutralName")) {
    issues.push({ issue: "versioned_content_surface_contract_missing_suggested_neutral_name_field", index, path: row.path ?? null });
  }
  return issues;
}

function pendingRewriteCountsBySubSurface(rewriteManifest) {
  const counts = {};
  for (const row of rewriteManifest?.rewrites ?? []) {
    const key = row.subSurfaceClass ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function packageScriptReadiness(queueArtifact) {
  const rows = queueArtifact?.queues?.packageScriptAliases ?? [];
  const byStatus = {};
  let blockedByExternalReferencesCount = 0;
  for (const row of rows) {
    byStatus[row.status ?? "missing"] = (byStatus[row.status ?? "missing"] ?? 0) + 1;
    if ((row.externalReferenceCount ?? 0) > 0) blockedByExternalReferencesCount += 1;
  }
  return {
    aliasCount: rows.length,
    readyForRemovalCount: rows.filter((row) => row.status === "ready_for_removal").length,
    blockedCount: rows.filter((row) => row.status !== "ready_for_removal").length,
    blockedByExternalReferencesCount,
    byStatus: sortedObjectFromCounts(byStatus),
  };
}

export function buildVersionedContentSurfaceCoverage(root = DEFAULT_ROOT, options = {}) {
  const issues = [];
  const inventoryRel = options.inventoryRel ?? CONTENT_CONTRACT_INVENTORY_REL;
  const queueRel = options.queueRel ?? COMPATIBILITY_REMOVAL_QUEUE_REL;
  const allowlistRel = options.allowlistRel ?? VERSION_REFERENCE_ALLOWLIST_REL;
  const rewriteManifestRel = options.rewriteManifestRel ?? LOCAL_CONTENT_REWRITE_MANIFEST_REL;

  const inventory = readJson(root, inventoryRel, null);
  const queueArtifact = readJson(root, queueRel, null);
  const allowlistArtifact = readJson(root, allowlistRel, null);
  const rewriteManifest = readJson(root, rewriteManifestRel, null);

  if (!inventory) issues.push({ issue: "versioned_content_surface_missing_inventory", path: inventoryRel });
  if (!queueArtifact) issues.push({ issue: "versioned_content_surface_missing_compatibility_queue", path: queueRel });
  if (!allowlistArtifact) issues.push({ issue: "versioned_content_surface_missing_allowlist", path: allowlistRel });
  if (!rewriteManifest) issues.push({ issue: "versioned_content_surface_missing_rewrite_manifest", path: rewriteManifestRel });

  const queueRows = flattenQueueRows(queueArtifact);
  const allowlistRows = compileAllowlist(allowlistArtifact, issues);
  const remainingSafeActionBySubSurface = pendingRewriteCountsBySubSurface(rewriteManifest);
  const bySubSurface = new Map();

  const totals = {
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
  };

  for (const [index, row] of (inventory?.contracts ?? []).entries()) {
    const metadataIssues = validateContractRow(row, index);
    issues.push(...metadataIssues);
    totals.missingMetadataCount += metadataIssues.length;

    const subSurfaceClass = row.subSurfaceClass ?? "missing";
    const queueCovered = queueCoversContract(row, queueRows);
    const allowlistCovered = allowlistCoversContract(row, allowlistRows);
    const documentationOnly = isDocumentationOnly(row);
    const manualOnly = Boolean(row.manualOnly);
    const count = Number(row.count ?? 0);
    const validationCovered = typeof row.validationCommand === "string" && row.validationCommand.trim() !== "";

    if (!bySubSurface.has(subSurfaceClass)) {
      bySubSurface.set(subSurfaceClass, {
        subSurfaceClass,
        surfaceClasses: new Set(),
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
      });
    }
    const bucket = bySubSurface.get(subSurfaceClass);
    bucket.surfaceClasses.add(row.surfaceClass ?? "missing");
    bucket.owners[row.owner ?? "missing"] = (bucket.owners[row.owner ?? "missing"] ?? 0) + 1;
    bucket.contractCount += 1;
    bucket.hitCount += count;
    bucket.missingMetadataCount += metadataIssues.length;
    if (validationCovered) bucket.validationCommandCoveredCount += 1;

    totals.contractCount += 1;
    totals.hitCount += count;
    if (validationCovered) totals.validationCommandCoveredCount += 1;

    if (manualOnly) {
      bucket.manualOnlyContractCount += 1;
      totals.manualOnlyContractCount += 1;
      if (queueCovered) {
        bucket.queueCoveredManualCount += 1;
        totals.queueCoveredManualCount += 1;
      }
      if (allowlistCovered) {
        bucket.allowlistCoveredManualCount += 1;
        totals.allowlistCoveredManualCount += 1;
      }
      if (documentationOnly) {
        bucket.documentationOnlyManualCount += 1;
        totals.documentationOnlyManualCount += 1;
      }
      if (!queueCovered && !allowlistCovered && !documentationOnly) {
        bucket.uncoveredManualCount += 1;
        totals.uncoveredManualCount += 1;
        issues.push({
          issue: "versioned_content_surface_manual_contract_uncovered",
          index,
          path: row.path ?? null,
          subSurfaceClass,
          contractName: row.contractName ?? null,
        });
      }
    }
  }

  for (const [subSurfaceClass, count] of Object.entries(remainingSafeActionBySubSurface)) {
    if (!bySubSurface.has(subSurfaceClass)) {
      bySubSurface.set(subSurfaceClass, {
        subSurfaceClass,
        surfaceClasses: new Set(),
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
      });
    }
    bySubSurface.get(subSurfaceClass).remainingSafeActionCount += count;
    totals.remainingSafeActionCount += count;
  }

  const subSurfaceRows = Array.from(bySubSurface.values())
    .map((row) => ({
      ...row,
      surfaceClasses: Array.from(row.surfaceClasses).sort((a, b) => a.localeCompare(b)),
      owners: sortedObjectFromCounts(row.owners),
    }))
    .sort((a, b) => a.subSurfaceClass.localeCompare(b.subSurfaceClass));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-content-surface-coverage.mjs --write",
    policy:
      "Summarize versioned content sub-surface coverage from deterministic inventories and queues. Checklist docs are not configuration and do not satisfy runtime coverage.",
    sourceArtifacts: {
      contentContracts: inventoryRel,
      compatibilityRemovalQueue: queueRel,
      versionReferenceAllowlist: allowlistRel,
      localContentRewriteManifest: rewriteManifestRel,
    },
    totals: {
      ...totals,
      subSurfaceCount: subSurfaceRows.length,
    },
    packageScriptReadiness: packageScriptReadiness(queueArtifact),
    bySubSurface: subSurfaceRows,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedContentSurfaceCoverage(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedContentSurfaceCoverage(root, options);
  const issues = [...current.issues];
  const artifactPath = path.join(root, artifactRel);
  if (!fs.existsSync(artifactPath)) {
    issues.push({ issue: "versioned_content_surface_coverage_missing", path: artifactRel });
  } else {
    const committed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (stableStringify(committed) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
      issues.push({
        issue: "versioned_content_surface_coverage_drift",
        path: artifactRel,
        hint: "Run npm run write:versioned-content-surface-coverage",
      });
    }
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    subSurfaceCount: current.totals.subSurfaceCount,
    contractCount: current.totals.contractCount,
    manualOnlyContractCount: current.totals.manualOnlyContractCount,
    uncoveredManualCount: current.totals.uncoveredManualCount,
    remainingSafeActionCount: current.totals.remainingSafeActionCount,
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
  const artifact = buildVersionedContentSurfaceCoverage(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

export function runVersionedContentSurfaceCoverage(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issues.length === 0,
          wrote: options.artifactRel,
          subSurfaceCount: artifact.totals.subSurfaceCount,
          contractCount: artifact.totals.contractCount,
          manualOnlyContractCount: artifact.totals.manualOnlyContractCount,
          uncoveredManualCount: artifact.totals.uncoveredManualCount,
          remainingSafeActionCount: artifact.totals.remainingSafeActionCount,
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
  const report = analyzeVersionedContentSurfaceCoverage(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedContentSurfaceCoverage();
}
