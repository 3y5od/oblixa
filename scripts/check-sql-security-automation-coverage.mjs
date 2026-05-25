#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/sql-security-automation-coverage.json";
const CONTENT_CONTRACT_INVENTORY_REL = "artifacts/compatibility/versioned-content-contract-inventory.json";
const SQL_RENAME_STAGING_REL = "artifacts/supabase/sql-object-rename-staging.json";
const COMPATIBILITY_REMOVAL_QUEUE_REL = "artifacts/compatibility/removal-queue.json";

const KIND_RULES = [
  { kind: "rls_policy", pattern: /\bpolicy\b|Members can read|No direct member access/iu },
  { kind: "function_grant", pattern: /\bgrant\b|\brevoke\b|execute|function/iu },
  { kind: "trigger_or_trigger_function", pattern: /\btrigger\b/iu },
  { kind: "realtime_or_publication", pattern: /\bpublication\b|realtime/iu },
  { kind: "storage_policy", pattern: /\bstorage\b|bucket/iu },
  { kind: "security_helper", pattern: /\bmember_can_read\b|\brole_rank\b|security/iu },
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

function stagingRows(staging) {
  return Array.isArray(staging) ? staging : staging?.stagedRenames ?? staging?.renames ?? staging?.entries ?? [];
}

function kindFor(row) {
  const haystack = `${row.contractName ?? ""}\n${row.legacyObject ?? ""}\n${row.objectType ?? ""}\n${row.path ?? ""}\n${row.subSurfaceClass ?? ""}`;
  return KIND_RULES.find((rule) => rule.pattern.test(haystack))?.kind ?? "sql_security_or_automation";
}

function queueCovers(row, queueRows) {
  const legacy = row.contractName ?? row.legacyObject ?? row.legacyName;
  const sourcePath = row.path ?? row.sourcePath;
  return queueRows.some((queueRow) => {
    if (queueRow.legacyName !== legacy) return false;
    if (sourcePath && queueRow.sourcePath && queueRow.sourcePath === sourcePath) return true;
    if (queueRow.surface === "sql_object" || queueRow.surface === row.surfaceClass || queueRow.subSurface === row.subSurfaceClass) return true;
    return false;
  });
}

function contentSecurityRows(inventory) {
  return (inventory?.contracts ?? [])
    .filter((row) => row.subSurfaceClass === "sql_security_object")
    .map((row) => ({
      source: "content_contract_inventory",
      kind: kindFor(row),
      legacyName: row.contractName,
      neutralAlias: row.suggestedNeutralName ?? null,
      sourcePath: row.path,
      owner: row.owner,
      reason: row.reason,
      validationCommand: row.validationCommand,
      manualFollowUp: row.manualFollowUp,
      manualOnly: Boolean(row.manualOnly),
      surfaceClass: row.surfaceClass,
      subSurfaceClass: row.subSurfaceClass,
    }));
}

function stagingSecurityRows(staging) {
  return stagingRows(staging)
    .filter((row) => ["function", "policy", "trigger"].includes(row.objectType))
    .map((row) => ({
      source: "sql_object_rename_staging",
      kind: kindFor(row),
      legacyName: row.legacyObject,
      neutralAlias: row.newObject,
      sourcePath: "artifacts/supabase/sql-object-rename-staging.json",
      owner: row.owner,
      reason: row.reason,
      validationCommand: row.validationCommand,
      validationSql: row.validationSql,
      manualFollowUp: row.manualFollowUp,
      manualOnly: true,
      objectType: row.objectType,
    }));
}

export function buildSqlSecurityAutomationCoverage(root = DEFAULT_ROOT, options = {}) {
  const inventoryRel = options.inventoryRel ?? CONTENT_CONTRACT_INVENTORY_REL;
  const stagingRel = options.stagingRel ?? SQL_RENAME_STAGING_REL;
  const queueRel = options.queueRel ?? COMPATIBILITY_REMOVAL_QUEUE_REL;
  const inventory = readJson(root, inventoryRel, null);
  const staging = readJson(root, stagingRel, null);
  const queueArtifact = readJson(root, queueRel, null);
  const issues = [];
  if (!inventory) issues.push({ issue: "sql_security_automation_missing_content_inventory", path: inventoryRel });
  if (!staging) issues.push({ issue: "sql_security_automation_missing_staging", path: stagingRel });
  if (!queueArtifact) issues.push({ issue: "sql_security_automation_missing_queue", path: queueRel });

  const queueRows = flattenQueueRows(queueArtifact);
  const rows = [...contentSecurityRows(inventory), ...stagingSecurityRows(staging)]
    .map((row, index) => {
      for (const key of ["legacyName", "owner", "reason", "validationCommand", "manualFollowUp"]) {
        if (typeof row[key] !== "string" || row[key].trim() === "") {
          issues.push({ issue: "sql_security_automation_missing_metadata", index, key, legacyName: row.legacyName ?? null });
        }
      }
      const queueCovered = queueCovers(row, queueRows);
      if (!queueCovered) {
        issues.push({ issue: "sql_security_automation_missing_queue_coverage", legacyName: row.legacyName, kind: row.kind });
      }
      return { ...row, queueCovered };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.legacyName.localeCompare(b.legacyName) || a.source.localeCompare(b.source));

  const kindCounts = Object.fromEntries(
    Object.entries(
      rows.reduce((counts, row) => {
        counts[row.kind] = (counts[row.kind] ?? 0) + 1;
        return counts;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-sql-security-automation-coverage.mjs --write",
    inventoryPath: inventoryRel,
    stagingPath: stagingRel,
    queuePath: queueRel,
    coverageCount: rows.length,
    queueCoveredCount: rows.filter((row) => row.queueCovered).length,
    kindCounts,
    rows,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeSqlSecurityAutomationCoverage(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildSqlSecurityAutomationCoverage(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push({ issue: "sql_security_automation_artifact_missing", path: artifactRel });
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push({ issue: "sql_security_automation_artifact_drift", path: artifactRel, hint: "Run npm run write:sql-security-automation-coverage" });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    coverageCount: current.coverageCount,
    queueCoveredCount: current.queueCoveredCount,
    kindCounts: current.kindCounts,
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

export function runSqlSecurityAutomationCoverage(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildSqlSecurityAutomationCoverage(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(JSON.stringify({ ok: artifact.issueCount === 0, wrote: options.artifactRel, coverageCount: artifact.coverageCount, issueCount: artifact.issueCount }, null, 2));
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeSqlSecurityAutomationCoverage(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlSecurityAutomationCoverage();
}
