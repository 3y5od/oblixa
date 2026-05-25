#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-export-download-contracts.json";
const CONTENT_CONTRACT_INVENTORY_REL = "artifacts/compatibility/versioned-content-contract-inventory.json";
const COMPATIBILITY_REMOVAL_QUEUE_REL = "artifacts/compatibility/removal-queue.json";

const CATEGORY_DEFINITIONS = [
  { id: "csv_contracts", pattern: /\bcsv\b|column|header/iu },
  { id: "pdf_contracts", pattern: /\bpdf\b/iu },
  { id: "report_artifacts", pattern: /report|attachment|pack|artifact/iu },
  { id: "content_disposition", pattern: /content[-_ ]?disposition|filename/iu },
  { id: "signed_link_artifacts", pattern: /signed|storage|bucket|object[-_ ]?path/iu },
  { id: "export_import_diagnostics", pattern: /export|import|download|diagnostic|job/iu },
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

function flattenQueueRows(queueArtifact) {
  return Object.values(queueArtifact?.queues ?? {}).flatMap((rows) => (Array.isArray(rows) ? rows : []));
}

function queueCovers(row, queueRows) {
  return queueRows.some((queueRow) => {
    if (queueRow.legacyName !== row.contractName) return false;
    if (queueRow.sourcePath && queueRow.sourcePath === row.path) return true;
    if (queueRow.subSurface && queueRow.subSurface === row.subSurfaceClass) return true;
    if (queueRow.surface && (queueRow.surface === row.surfaceClass || queueRow.surface === row.subSurfaceClass)) return true;
    return false;
  });
}

function isExportDownloadRow(row) {
  if (row.subSurfaceClass === "notification_or_export_contract") return true;
  const haystack = `${row.path ?? ""}\n${row.contractName ?? ""}\n${row.subSurfaceClass ?? ""}\n${row.surfaceClass ?? ""}`;
  return /\b(?:csv|pdf|report|download|export|import|content[-_ ]?disposition|filename|artifact)\b/iu.test(haystack);
}

function categoryFor(row) {
  const haystack = `${row.path ?? ""}\n${row.contractName ?? ""}\n${row.subSurfaceClass ?? ""}`;
  return CATEGORY_DEFINITIONS.find((category) => category.pattern.test(haystack))?.id ?? "export_import_diagnostics";
}

function validateRow(row, index) {
  const issues = [];
  for (const key of ["path", "surfaceClass", "subSurfaceClass", "contractName", "owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push({ issue: "versioned_export_download_missing_metadata", index, key, path: row.path ?? null });
    }
  }
  if (typeof row.manualOnly !== "boolean") {
    issues.push({ issue: "versioned_export_download_missing_manual_only", index, path: row.path ?? null });
  }
  if (!Object.prototype.hasOwnProperty.call(row, "suggestedNeutralName")) {
    issues.push({ issue: "versioned_export_download_missing_suggested_neutral_field", index, path: row.path ?? null });
  }
  return issues;
}

export function buildVersionedExportDownloadContracts(root = DEFAULT_ROOT, options = {}) {
  const inventoryRel = options.inventoryRel ?? CONTENT_CONTRACT_INVENTORY_REL;
  const queueRel = options.queueRel ?? COMPATIBILITY_REMOVAL_QUEUE_REL;
  const inventory = readJson(root, inventoryRel, null);
  const queueArtifact = readJson(root, queueRel, null);
  const issues = [];

  if (!inventory) issues.push({ issue: "versioned_export_download_missing_inventory", path: inventoryRel });
  if (!queueArtifact) issues.push({ issue: "versioned_export_download_missing_queue", path: queueRel });

  const queueRows = flattenQueueRows(queueArtifact);
  const contracts = inventory?.contracts ?? [];
  const manualCompatKeys = new Set(
    contracts
      .filter((row) => row.manualOnly && row.contractName && row.path)
      .map((row) => `${row.path}\0${row.contractName}`),
  );
  const rows = contracts
    .filter(isExportDownloadRow)
    .map((row, index) => {
      const metadataIssues = validateRow(row, index);
      issues.push(...metadataIssues);
      const queueCovered = queueCovers(row, queueRows);
      const manualOnly = Boolean(row.manualOnly || manualCompatKeys.has(`${row.path}\0${row.contractName}`));
      if (manualOnly && !queueCovered) {
        issues.push({
          issue: "versioned_export_download_manual_row_unqueued",
          path: row.path,
          contractName: row.contractName,
          subSurfaceClass: row.subSurfaceClass,
        });
      }
      return {
        category: categoryFor(row),
        path: row.path,
        contractName: row.contractName,
        surfaceClass: row.surfaceClass,
        subSurfaceClass: row.subSurfaceClass,
        owner: row.owner,
        reason: row.reason,
        manualOnly,
        suggestedNeutralName: row.suggestedNeutralName ?? null,
        removalStrategy: row.removalStrategy,
        validationCommand: row.validationCommand,
        manualFollowUp: row.manualFollowUp,
        queueCovered,
        hitCount: row.count ?? 0,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.path.localeCompare(b.path) || a.contractName.localeCompare(b.contractName));

  const categories = CATEGORY_DEFINITIONS.map((category) => {
    const categoryRows = rows.filter((row) => row.category === category.id);
    return {
      id: category.id,
      contractCount: categoryRows.length,
      hitCount: categoryRows.reduce((sum, row) => sum + Number(row.hitCount ?? 0), 0),
      manualOnlyCount: categoryRows.filter((row) => row.manualOnly).length,
      queueCoveredManualCount: categoryRows.filter((row) => row.manualOnly && row.queueCovered).length,
      remainingSafeActionCount: categoryRows.filter((row) => !row.manualOnly && row.suggestedNeutralName).length,
      validationCommandCoveredCount: categoryRows.filter((row) => typeof row.validationCommand === "string" && row.validationCommand.trim()).length,
    };
  });

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-export-download-contracts.mjs --write",
    inventoryPath: inventoryRel,
    queuePath: queueRel,
    categoryCount: categories.length,
    contractCount: rows.length,
    manualOnlyContractCount: rows.filter((row) => row.manualOnly).length,
    queueCoveredManualCount: rows.filter((row) => row.manualOnly && row.queueCovered).length,
    remainingSafeActionCount: categories.reduce((sum, category) => sum + category.remainingSafeActionCount, 0),
    categories,
    contracts: rows,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedExportDownloadContracts(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedExportDownloadContracts(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push({ issue: "versioned_export_download_artifact_missing", path: artifactRel });
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push({ issue: "versioned_export_download_artifact_drift", path: artifactRel, hint: "Run npm run write:versioned-export-download-contracts" });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    categoryCount: current.categoryCount,
    contractCount: current.contractCount,
    manualOnlyContractCount: current.manualOnlyContractCount,
    queueCoveredManualCount: current.queueCoveredManualCount,
    remainingSafeActionCount: current.remainingSafeActionCount,
    issueCount: issues.length,
    issues,
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

export function runVersionedExportDownloadContracts(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildVersionedExportDownloadContracts(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(JSON.stringify({ ok: artifact.issueCount === 0, wrote: options.artifactRel, contractCount: artifact.contractCount, issueCount: artifact.issueCount }, null, 2));
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeVersionedExportDownloadContracts(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedExportDownloadContracts();
}
