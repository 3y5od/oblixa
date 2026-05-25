#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_SQL_REL = "supabase/sql/read_only_operational_snapshot.sql";
const REQUIRED_SECTIONS = [
  "extension_summary",
  "function_summary",
  "migration_ledger",
  "policy_summary",
  "rls_summary",
  "table_summary",
];
const WRITE_PATTERNS = [
  /\balter\s+/iu,
  /\bcall\s+/iu,
  /\bcopy\s+/iu,
  /\bcreate\s+/iu,
  /\bdelete\s+/iu,
  /\bdrop\s+/iu,
  /\bgrant\s+/iu,
  /\binsert\s+/iu,
  /\breindex\s+/iu,
  /\brevoke\s+/iu,
  /\bset\s+role\b/iu,
  /\btruncate\s+/iu,
  /\bupdate\s+/iu,
];

function readText(abs) {
  return fs.readFileSync(abs, "utf8");
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .split(/\r?\n/u)
    .map((line) => line.replace(/--.*$/u, ""))
    .join("\n");
}

function parseJsonPayload(text) {
  const raw = String(text ?? "").trim();
  const objectIndex = raw.indexOf("{");
  const arrayIndex = raw.indexOf("[");
  const starts = [objectIndex, arrayIndex].filter((index) => index >= 0).sort((a, b) => a - b);
  if (starts.length === 0) throw new Error("No JSON payload found.");
  return JSON.parse(raw.slice(starts[0]));
}

function parsePayloadValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  return JSON.parse(trimmed);
}

export function validateSnapshotSql(sql) {
  const body = stripSqlComments(sql);
  const issues = [];

  for (const pattern of WRITE_PATTERNS) {
    const match = pattern.exec(body);
    if (match) {
      issues.push({
        issue: "snapshot_sql_must_be_read_only",
        pattern: pattern.source,
        token: match[0].trim(),
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function parseSupabaseSnapshotRows(input) {
  const payload = typeof input === "string" ? parseJsonPayload(input) : input;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return rows.map((row) => ({
    section: row.section,
    payload: parsePayloadValue(row.payload),
  }));
}

function rowsBySection(rows) {
  return new Map(rows.map((row) => [row.section, row.payload]));
}

function tableKey(row) {
  return `${row.schema ?? "public"}.${row.table ?? row.name}`;
}

function manualFollowUpSqlFor(issue) {
  if (issue.issue === "snapshot_missing_migration_versions") {
    const versions = issue.missingRemote.map((version) => `'${version}'`).join(", ");
    return `select version from supabase_migrations.schema_migrations where version in (${versions}) order by version;`;
  }
  if (issue.issue === "snapshot_extra_migration_versions") {
    const versions = issue.extraRemote.map((version) => `'${version}'`).join(", ");
    return `select version from supabase_migrations.schema_migrations where version in (${versions}) order by version;`;
  }
  if (issue.issue === "snapshot_rls_table_without_policy") {
    return `select * from pg_policies where schemaname = '${issue.schema}' and tablename = '${issue.table}' order by policyname;`;
  }
  return null;
}

export function analyzeSupabaseSnapshot(rows, options = {}) {
  const sectionMap = rowsBySection(rows);
  const issues = [];

  for (const section of REQUIRED_SECTIONS) {
    if (!sectionMap.has(section)) {
      issues.push({ issue: "snapshot_missing_required_section", section });
    }
  }

  const expectedMigrationVersions = options.expectedMigrationVersions ?? [];
  const ledgerVersions = sectionMap.get("migration_ledger")?.versions ?? [];
  if (expectedMigrationVersions.length > 0) {
    const missingRemote = expectedMigrationVersions.filter((version) => !ledgerVersions.includes(version));
    const extraRemote = ledgerVersions.filter((version) => !expectedMigrationVersions.includes(version));
    if (missingRemote.length > 0) {
      issues.push({ issue: "snapshot_missing_migration_versions", missingRemote });
    }
    if (extraRemote.length > 0) {
      issues.push({ issue: "snapshot_extra_migration_versions", extraRemote });
    }
  }

  const unprotected = sectionMap.get("rls_summary")?.unprotectedRlsTables ?? [];
  for (const row of unprotected) {
    issues.push({
      issue: "snapshot_rls_table_without_policy",
      schema: row.schema ?? "public",
      table: row.name ?? row.table,
      policyCount: row.policyCount ?? 0,
    });
  }

  const requiredPolicyTables = options.requiredPolicyTables ?? [];
  if (requiredPolicyTables.length > 0) {
    const policyTables = new Set((sectionMap.get("policy_summary")?.policies ?? []).map(tableKey));
    for (const required of requiredPolicyTables) {
      if (!policyTables.has(required)) {
        const [schema, table] = required.split(".");
        issues.push({
          issue: "snapshot_required_policy_table_missing",
          schema,
          table,
        });
      }
    }
  }

  const manualFollowUpSql = issues.map(manualFollowUpSqlFor).filter(Boolean);
  return {
    ok: issues.length === 0,
    sectionCount: sectionMap.size,
    sections: Array.from(sectionMap.keys()).sort(),
    migrationLedger: sectionMap.get("migration_ledger") ?? null,
    rlsSummary: sectionMap.get("rls_summary") ?? null,
    issueCount: issues.length,
    issues,
    manualFollowUpSql,
  };
}

export function readLocalMigrationVersions(root = DEFAULT_ROOT) {
  const migrationsDir = path.join(root, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => /^(\d+)_/u.exec(name)?.[1])
    .filter(Boolean)
    .sort();
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    sqlRel: DEFAULT_SQL_REL,
    fixture: null,
    expectedLocal: false,
    report: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
      continue;
    }
    if (arg === "--fixture") {
      options.fixture = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg.startsWith("--fixture=")) {
      options.fixture = path.resolve(arg.slice("--fixture=".length));
      continue;
    }
    if (arg === "--expected-local") {
      options.expectedLocal = true;
      continue;
    }
    if (arg === "--report") {
      options.report = true;
    }
  }

  return options;
}

export function runSupabaseSnapshotBundleCheck(options = parseArgs(process.argv.slice(2))) {
  const sqlPath = path.join(options.root, options.sqlRel);
  const sql = readText(sqlPath);
  const sqlReport = validateSnapshotSql(sql);
  let snapshotReport = null;

  if (options.fixture) {
    const rows = parseSupabaseSnapshotRows(readText(options.fixture));
    snapshotReport = analyzeSupabaseSnapshot(rows, {
      expectedMigrationVersions: options.expectedLocal ? readLocalMigrationVersions(options.root) : [],
    });
  }

  const report = {
    ok: sqlReport.ok && (snapshotReport?.ok ?? true),
    sqlPath: toPosix(path.relative(options.root, sqlPath)),
    sqlReadOnly: sqlReport.ok,
    sqlIssues: sqlReport.issues,
    snapshot: snapshotReport,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseSnapshotBundleCheck();
}
