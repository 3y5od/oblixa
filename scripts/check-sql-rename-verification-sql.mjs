#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/sql-rename-verification-sql.json";
const SQL_RENAME_STAGING_REL = "artifacts/supabase/sql-object-rename-staging.json";
const READ_ONLY_SQL_RE = /^\s*select\b/iu;
const MUTATING_SQL_RE = /\b(?:insert|update|delete|drop|alter|create|grant|revoke|truncate|call|do)\b/iu;

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

function stagedRows(staging) {
  return Array.isArray(staging) ? staging : staging?.stagedRenames ?? staging?.renames ?? staging?.entries ?? [];
}

function validateSql(row, issues) {
  const sql = String(row.validationSql ?? "").trim();
  if (!sql) {
    issues.push({ issue: "sql_rename_verification_missing_sql", legacyObject: row.legacyObject ?? null });
    return;
  }
  if (!READ_ONLY_SQL_RE.test(sql) || MUTATING_SQL_RE.test(sql)) {
    issues.push({ issue: "sql_rename_verification_not_read_only", legacyObject: row.legacyObject ?? null, validationSql: sql });
  }
}

export function buildSqlRenameVerificationSql(root = DEFAULT_ROOT, options = {}) {
  const stagingRel = options.stagingRel ?? SQL_RENAME_STAGING_REL;
  const staging = readJson(root, stagingRel, null);
  const issues = [];
  if (!staging) issues.push({ issue: "sql_rename_verification_missing_staging", path: stagingRel });

  const statements = stagedRows(staging)
    .map((row) => {
      for (const key of ["legacyObject", "newObject", "objectType", "owner", "validationCommand", "validationSql", "manualFollowUp"]) {
        if (typeof row[key] !== "string" || row[key].trim() === "") {
          issues.push({ issue: "sql_rename_verification_missing_metadata", key, legacyObject: row.legacyObject ?? null });
        }
      }
      validateSql(row, issues);
      return {
        legacyObject: row.legacyObject,
        neutralObject: row.newObject,
        objectType: row.objectType,
        dataBearing: Boolean(row.dataBearing),
        owner: row.owner,
        status: row.status,
        validationCommand: row.validationCommand,
        validationSql: String(row.validationSql ?? "").trim().replace(/;?$/u, ";"),
        cutoverStrategy: row.cutoverStrategy,
        manualFollowUp: row.manualFollowUp,
      };
    })
    .sort((a, b) => a.objectType.localeCompare(b.objectType) || a.legacyObject.localeCompare(b.legacyObject));

  const combinedSql = statements
    .map((row) => [`-- ${row.objectType}: ${row.legacyObject} -> ${row.neutralObject}`, row.validationSql].join("\n"))
    .join("\n\n");

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-sql-rename-verification-sql.mjs --write",
    stagingPath: stagingRel,
    statementCount: statements.length,
    objectTypeCounts: Object.fromEntries(
      Object.entries(
        statements.reduce((counts, row) => {
          counts[row.objectType] = (counts[row.objectType] ?? 0) + 1;
          return counts;
        }, {}),
      ).sort(([a], [b]) => a.localeCompare(b)),
    ),
    statements,
    combinedSql,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeSqlRenameVerificationSql(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildSqlRenameVerificationSql(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push({ issue: "sql_rename_verification_artifact_missing", path: artifactRel });
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push({ issue: "sql_rename_verification_artifact_drift", path: artifactRel, hint: "Run npm run write:sql-rename-verification-sql" });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    statementCount: current.statementCount,
    objectTypeCounts: current.objectTypeCounts,
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

export function runSqlRenameVerificationSql(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildSqlRenameVerificationSql(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(JSON.stringify({ ok: artifact.issueCount === 0, wrote: options.artifactRel, statementCount: artifact.statementCount, issueCount: artifact.issueCount }, null, 2));
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeSqlRenameVerificationSql(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlRenameVerificationSql();
}
