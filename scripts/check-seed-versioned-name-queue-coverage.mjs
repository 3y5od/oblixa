#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/seed-versioned-name-queue-coverage.json";
const CONTENT_CONTRACT_INVENTORY_REL = "artifacts/compatibility/versioned-content-contract-inventory.json";
const COMPATIBILITY_REMOVAL_QUEUE_REL = "artifacts/compatibility/removal-queue.json";

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
    if (queueRow.sourcePath === row.path) return true;
    if (queueRow.subSurface === row.subSurfaceClass) return true;
    if (queueRow.surface === row.surfaceClass || queueRow.surface === "sql_object") return true;
    return false;
  });
}

export function buildSeedVersionedNameQueueCoverage(root = DEFAULT_ROOT, options = {}) {
  const inventoryRel = options.inventoryRel ?? CONTENT_CONTRACT_INVENTORY_REL;
  const queueRel = options.queueRel ?? COMPATIBILITY_REMOVAL_QUEUE_REL;
  const inventory = readJson(root, inventoryRel, null);
  const queueArtifact = readJson(root, queueRel, null);
  const issues = [];
  if (!inventory) issues.push({ issue: "seed_versioned_queue_missing_inventory", path: inventoryRel });
  if (!queueArtifact) issues.push({ issue: "seed_versioned_queue_missing_queue", path: queueRel });
  const queueRows = flattenQueueRows(queueArtifact);
  const rows = (inventory?.contracts ?? [])
    .filter((row) => row.path === "supabase/seed.sql" || row.subSurfaceClass === "seed_fixture_key")
    .map((row, index) => {
      const queueCovered = queueCovers(row, queueRows);
      for (const key of ["path", "surfaceClass", "subSurfaceClass", "contractName", "owner", "reason", "validationCommand", "manualFollowUp"]) {
        if (typeof row[key] !== "string" || row[key].trim() === "") {
          issues.push({ issue: "seed_versioned_queue_missing_metadata", index, key, path: row.path ?? null });
        }
      }
      if (row.manualOnly && !queueCovered) {
        issues.push({ issue: "seed_versioned_queue_manual_row_unqueued", path: row.path, contractName: row.contractName });
      }
      return {
        path: row.path,
        contractName: row.contractName,
        surfaceClass: row.surfaceClass,
        subSurfaceClass: row.subSurfaceClass,
        owner: row.owner,
        reason: row.reason,
        manualOnly: Boolean(row.manualOnly),
        suggestedNeutralName: row.suggestedNeutralName ?? null,
        validationCommand: row.validationCommand,
        manualFollowUp: row.manualFollowUp,
        queueCovered,
        hitCount: row.count ?? 0,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.contractName.localeCompare(b.contractName));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-seed-versioned-name-queue-coverage.mjs --write",
    inventoryPath: inventoryRel,
    queuePath: queueRel,
    seedContractCount: rows.length,
    manualOnlySeedContractCount: rows.filter((row) => row.manualOnly).length,
    queueCoveredManualCount: rows.filter((row) => row.manualOnly && row.queueCovered).length,
    rows,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeSeedVersionedNameQueueCoverage(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildSeedVersionedNameQueueCoverage(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push({ issue: "seed_versioned_queue_artifact_missing", path: artifactRel });
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push({ issue: "seed_versioned_queue_artifact_drift", path: artifactRel, hint: "Run npm run write:seed-versioned-name-queue-coverage" });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    seedContractCount: current.seedContractCount,
    manualOnlySeedContractCount: current.manualOnlySeedContractCount,
    queueCoveredManualCount: current.queueCoveredManualCount,
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

export function runSeedVersionedNameQueueCoverage(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildSeedVersionedNameQueueCoverage(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(JSON.stringify({ ok: artifact.issueCount === 0, wrote: options.artifactRel, seedContractCount: artifact.seedContractCount, issueCount: artifact.issueCount }, null, 2));
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeSeedVersionedNameQueueCoverage(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeedVersionedNameQueueCoverage();
}
