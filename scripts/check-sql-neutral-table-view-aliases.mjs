#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/sql-neutral-table-view-aliases.json";
const DEFAULT_STAGING_REL = "artifacts/supabase/sql-object-rename-staging.json";
const DEFAULT_MIGRATION_REL = "supabase/migrations/089_sql_neutral_table_view_aliases.sql";

const MUTATION_OR_DDL_RE =
  /\b(?:insert|update|delete|truncate|merge|copy|drop\b|alter\s+table|create\s+table|create\s+policy|alter\s+policy|drop\s+policy|create\s+trigger|create\s+function)\b/iu;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readText(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function stripSqlComments(sql) {
  return String(sql)
    .replace(/--.*$/gmu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "");
}

function stagedTableRows(staging) {
  return (staging?.stagedRenames ?? staging?.rows ?? staging?.entries ?? [])
    .filter((row) => row.objectType === "table")
    .sort((a, b) => String(a.legacyObject).localeCompare(String(b.legacyObject)));
}

function expectedGranteesFor(row) {
  return row.newObject === "public.mutation_idempotency" ? ["service_role"] : ["authenticated", "service_role"];
}

function parseSqlList(sql, regex) {
  const values = new Map();
  for (const match of String(sql).matchAll(regex)) {
    const key = match[1];
    const list = values.get(key) ?? [];
    list.push(match);
    values.set(key, list);
  }
  return values;
}

function normalizeRole(role) {
  return String(role).trim().toLowerCase();
}

function parseMigrationEvidence(sql) {
  const stripped = stripSqlComments(sql ?? "");
  const viewDefinitions = new Map();
  const viewRe =
    /\bcreate\s+or\s+replace\s+view\s+(public\.[a-z_][a-z0-9_]*)\s+with\s*\(\s*security_invoker\s*=\s*true\s*\)\s+as\s+select\s+\*\s+from\s+(public\.[a-z_][a-z0-9_]*)\s*;/giu;
  for (const match of stripped.matchAll(viewRe)) {
    viewDefinitions.set(match[1], {
      neutralObject: match[1],
      legacyObject: match[2],
      raw: match[0],
      securityInvoker: true,
    });
  }

  const createViewNames = new Set(
    [...stripped.matchAll(/\bcreate\s+or\s+replace\s+view\s+(public\.[a-z_][a-z0-9_]*)/giu)].map((match) => match[1]),
  );
  const revokes = new Set(
    [...stripped.matchAll(/\brevoke\s+all\s+on\s+table\s+(public\.[a-z_][a-z0-9_]*)\s+from\s+public\s*;/giu)].map((match) => match[1]),
  );
  const grants = new Map();
  for (const match of stripped.matchAll(/\bgrant\s+select\s+on\s+table\s+(public\.[a-z_][a-z0-9_]*)\s+to\s+([a-z_][a-z0-9_]*)\s*;/giu)) {
    const roles = grants.get(match[1]) ?? new Set();
    roles.add(normalizeRole(match[2]));
    grants.set(match[1], roles);
  }

  const broaderGrantRows = [];
  for (const match of stripped.matchAll(/\bgrant\s+(.+?)\s+on\s+table\s+(public\.[a-z_][a-z0-9_]*)\s+to\s+([a-z_][a-z0-9_]*)\s*;/giu)) {
    const privilege = String(match[1]).trim().toLowerCase();
    if (privilege !== "select") {
      broaderGrantRows.push({ neutralObject: match[2], privilege, role: normalizeRole(match[3]) });
    }
  }

  return {
    viewDefinitions,
    createViewNames,
    revokes,
    grants,
    broaderGrantRows,
    unsafeStatementMatch: stripped.match(MUTATION_OR_DDL_RE)?.[0] ?? null,
  };
}

function rowIssue(issue, row, fields = {}) {
  return { issue, legacyObject: row.legacyObject ?? null, neutralObject: row.newObject ?? null, ...fields };
}

function buildAliasRow(stagedRow, evidence) {
  const expectedGrantees = expectedGranteesFor(stagedRow);
  const actualGrantees = Array.from(evidence.grants.get(stagedRow.newObject) ?? []).sort((a, b) => a.localeCompare(b));
  const viewDefinition = evidence.viewDefinitions.get(stagedRow.newObject) ?? null;
  const unexpectedGrantees = actualGrantees.filter((role) => !expectedGrantees.includes(role));
  const missingGrantees = expectedGrantees.filter((role) => !actualGrantees.includes(role));

  return {
    legacyObject: stagedRow.legacyObject,
    neutralObject: stagedRow.newObject,
    owner: stagedRow.owner,
    reason: stagedRow.reason,
    validationCommand: "npm run check:sql-neutral-table-view-aliases",
    manualFollowUp: stagedRow.manualFollowUp,
    expectedGrantees,
    actualGrantees,
    viewDefined: Boolean(viewDefinition),
    securityInvoker: Boolean(viewDefinition?.securityInvoker),
    delegatesToLegacyTable: viewDefinition?.legacyObject === stagedRow.legacyObject,
    publicRevoked: evidence.revokes.has(stagedRow.newObject),
    missingGrantees,
    unexpectedGrantees,
    status: viewDefinition ? "alias_added" : "missing_alias",
  };
}

function validateAliasRow(row) {
  const issues = [];
  for (const key of ["legacyObject", "neutralObject", "owner", "reason", "validationCommand", "manualFollowUp"]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push({ issue: "sql_neutral_table_view_alias_missing_metadata", key, legacyObject: row.legacyObject ?? null });
    }
  }
  if (!row.viewDefined) issues.push({ issue: "sql_neutral_table_view_alias_missing_view", legacyObject: row.legacyObject, neutralObject: row.neutralObject });
  if (!row.securityInvoker) {
    issues.push({ issue: "sql_neutral_table_view_alias_missing_security_invoker", legacyObject: row.legacyObject, neutralObject: row.neutralObject });
  }
  if (!row.delegatesToLegacyTable) {
    issues.push({ issue: "sql_neutral_table_view_alias_wrong_delegate", legacyObject: row.legacyObject, neutralObject: row.neutralObject });
  }
  if (!row.publicRevoked) {
    issues.push({ issue: "sql_neutral_table_view_alias_missing_public_revoke", legacyObject: row.legacyObject, neutralObject: row.neutralObject });
  }
  for (const role of row.missingGrantees) {
    issues.push({ issue: "sql_neutral_table_view_alias_missing_grant", legacyObject: row.legacyObject, neutralObject: row.neutralObject, role });
  }
  for (const role of row.unexpectedGrantees) {
    issues.push({ issue: "sql_neutral_table_view_alias_broader_grant", legacyObject: row.legacyObject, neutralObject: row.neutralObject, role });
  }
  return issues;
}

export function buildSqlNeutralTableViewAliases(root = DEFAULT_ROOT, options = {}) {
  const stagingRel = options.stagingRel ?? DEFAULT_STAGING_REL;
  const migrationRel = options.migrationRel ?? DEFAULT_MIGRATION_REL;
  const expectedTableAliasCount = options.expectedTableAliasCount ?? 33;
  const staging = options.staging ?? readJson(root, stagingRel, null);
  const migrationSql = options.migrationSql ?? readText(root, migrationRel);
  const issues = [];

  if (!staging) issues.push({ issue: "sql_neutral_table_view_aliases_missing_staging", path: stagingRel });
  if (migrationSql === null) issues.push({ issue: "sql_neutral_table_view_aliases_missing_migration", path: migrationRel });

  const tableRows = stagedTableRows(staging);
  const evidence = parseMigrationEvidence(migrationSql ?? "");
  const rows = tableRows.map((row) => buildAliasRow(row, evidence));
  const expectedNeutralObjects = new Set(rows.map((row) => row.neutralObject));

  if (tableRows.length !== expectedTableAliasCount) {
    issues.push({ issue: "sql_neutral_table_view_aliases_unexpected_table_row_count", expected: expectedTableAliasCount, actual: tableRows.length });
  }
  if (evidence.unsafeStatementMatch) {
    issues.push({ issue: "sql_neutral_table_view_aliases_unsafe_sql_statement", match: evidence.unsafeStatementMatch });
  }
  for (const row of evidence.broaderGrantRows) {
    issues.push({ issue: "sql_neutral_table_view_aliases_non_select_grant", ...row });
  }
  for (const neutralObject of evidence.createViewNames) {
    if (!expectedNeutralObjects.has(neutralObject)) {
      issues.push({ issue: "sql_neutral_table_view_aliases_unexpected_view", neutralObject });
    }
  }

  issues.push(...rows.flatMap(validateAliasRow));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-sql-neutral-table-view-aliases.mjs --write",
    policy:
      "Prove neutral read-only compatibility views exist for staged data-bearing versioned SQL tables. This artifact does not authorize production migration application, policy duplication, writes, backfills, or legacy object removal.",
    sourceArtifacts: {
      sqlObjectRenameStaging: stagingRel,
      migration: migrationRel,
    },
    totals: {
      tableAliasCount: rows.length,
      aliasAddedCount: rows.filter((row) => row.status === "alias_added").length,
      memberReadableAliasCount: rows.filter((row) => row.expectedGrantees.includes("authenticated")).length,
      serviceRoleOnlyAliasCount: rows.filter((row) => !row.expectedGrantees.includes("authenticated")).length,
      issueCount: issues.length,
    },
    rows,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeSqlNeutralTableViewAliases(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildSqlNeutralTableViewAliases(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push({ issue: "sql_neutral_table_view_aliases_missing_artifact", path: artifactRel });
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push({ issue: "sql_neutral_table_view_aliases_artifact_drift", path: artifactRel, hint: "Run npm run write:sql-neutral-table-view-aliases" });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    tableAliasCount: current.totals.tableAliasCount,
    aliasAddedCount: current.totals.aliasAddedCount,
    memberReadableAliasCount: current.totals.memberReadableAliasCount,
    serviceRoleOnlyAliasCount: current.totals.serviceRoleOnlyAliasCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    artifactRel: DEFAULT_ARTIFACT_REL,
    stagingRel: DEFAULT_STAGING_REL,
    migrationRel: DEFAULT_MIGRATION_REL,
    write: false,
  };
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
    } else if (arg === "--staging") {
      options.stagingRel = argv[index + 1] ?? DEFAULT_STAGING_REL;
      index += 1;
    } else if (arg.startsWith("--staging=")) {
      options.stagingRel = arg.slice("--staging=".length);
    } else if (arg === "--migration") {
      options.migrationRel = argv[index + 1] ?? DEFAULT_MIGRATION_REL;
      index += 1;
    } else if (arg.startsWith("--migration=")) {
      options.migrationRel = arg.slice("--migration=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runSqlNeutralTableViewAliases(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildSqlNeutralTableViewAliases(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          tableAliasCount: artifact.totals.tableAliasCount,
          aliasAddedCount: artifact.totals.aliasAddedCount,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeSqlNeutralTableViewAliases(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlNeutralTableViewAliases();
}
