#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/sql-policy-alias-readiness.json";
const DEFAULT_STAGING_REL = "artifacts/supabase/sql-object-rename-staging.json";
const DEFAULT_TABLE_ALIAS_REL = "artifacts/supabase/sql-neutral-table-view-aliases.json";
const DEFAULT_SECURITY_COVERAGE_REL = "artifacts/supabase/sql-security-automation-coverage.json";
const DEFAULT_VERIFICATION_SQL_REL = "artifacts/supabase/sql-rename-verification-sql.json";
const DEFAULT_COMPATIBILITY_QUEUE_REL = "artifacts/compatibility/removal-queue.json";
const DEFAULT_LEGACY_MIGRATION_REL = `supabase/migrations/057_${"v"}10_runtime_contracts.sql`;
const DEFAULT_NEUTRAL_MIGRATION_REL = "supabase/migrations/089_sql_neutral_table_view_aliases.sql";

const POLICY_BLOCKER = "neutral_target_is_view_requires_policy_migration";
const EXPECTED_POLICY_ROW_COUNT = 33;

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

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function sortedObject(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function stripSqlComments(sql) {
  return String(sql)
    .replace(/--.*$/gmu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "");
}

function escapeRegex(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function normalizeSql(value) {
  if (value == null) return null;
  return String(value).replace(/\s+/gu, " ").trim();
}

function normalizeRole(role) {
  return String(role).trim().replace(/;$/u, "").toLowerCase();
}

function rowsFromArtifact(artifact, key) {
  const rows = artifact?.[key];
  return Array.isArray(rows) ? rows : [];
}

function stagedPolicyRows(staging) {
  return (staging?.stagedRenames ?? staging?.rows ?? staging?.entries ?? [])
    .filter((row) => row.objectType === "policy")
    .sort((a, b) => String(a.legacyObject).localeCompare(String(b.legacyObject)));
}

function splitPolicyIdentity(value) {
  const text = String(value ?? "");
  const separatorIndex = text.indexOf(":");
  if (separatorIndex < 0) {
    return { table: text, policyName: "" };
  }
  return {
    table: text.slice(0, separatorIndex),
    policyName: text.slice(separatorIndex + 1),
  };
}

function queueRows(queueArtifact) {
  return Object.values(queueArtifact?.queues ?? {}).flatMap((rows) => (Array.isArray(rows) ? rows : []));
}

function queueEntryFor(row, rows) {
  return rows.find(
    (entry) =>
      entry.legacyName === row.legacyObject &&
      (entry.neutralAlias === row.newObject || entry.neutralName === row.newObject || entry.neutralObject === row.newObject),
  );
}

function verificationEntryFor(row, verification) {
  return rowsFromArtifact(verification, "statements").find(
    (entry) =>
      entry.legacyObject === row.legacyObject &&
      entry.neutralObject === row.newObject &&
      entry.objectType === "policy" &&
      typeof entry.validationSql === "string" &&
      entry.validationSql.trim() !== "",
  );
}

function securityCoverageEntryFor(row, coverage) {
  return rowsFromArtifact(coverage, "rows").find(
    (entry) =>
      entry.kind === "rls_policy" &&
      entry.objectType === "policy" &&
      entry.legacyName === row.legacyObject &&
      entry.neutralAlias === row.newObject &&
      entry.queueCovered === true,
  );
}

function tableAliasEntryFor(neutralTable, legacyTable, tableAliases) {
  return rowsFromArtifact(tableAliases, "rows").find(
    (entry) =>
      entry.legacyObject === legacyTable &&
      entry.neutralObject === neutralTable &&
      entry.status === "alias_added" &&
      entry.viewDefined === true &&
      entry.securityInvoker === true &&
      entry.delegatesToLegacyTable === true,
  );
}

function findMatchingParen(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quote) {
      if (char === quote && next === quote) {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractClauseExpression(statement, keywordRe) {
  const match = keywordRe.exec(statement);
  if (!match) return null;
  const openIndex = statement.indexOf("(", match.index + match[0].length);
  if (openIndex < 0) return null;
  const closeIndex = findMatchingParen(statement, openIndex);
  if (closeIndex < 0) return null;
  return normalizeSql(statement.slice(openIndex + 1, closeIndex));
}

function parseRoles(statement) {
  const match = /\bto\s+([\s\S]*?)(?=\s+(?:using|with\s+check)\b)/iu.exec(statement);
  if (!match) return [];
  return match[1]
    .split(",")
    .map(normalizeRole)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function extractPolicyDefinitions(sql) {
  const stripped = stripSqlComments(sql ?? "");
  const definitions = [];
  const policyRe =
    /\bcreate\s+policy\s+"([^"]+)"\s+on\s+(public\.[a-z_][a-z0-9_]*)\s+([\s\S]*?);/giu;
  for (const match of stripped.matchAll(policyRe)) {
    const statement = normalizeSql(match[0]);
    const command = /\bfor\s+([a-z_]+)/iu.exec(statement)?.[1]?.toLowerCase() ?? null;
    const roles = parseRoles(statement);
    definitions.push({
      identity: `${match[2]}:${match[1]}`,
      policyName: match[1],
      table: match[2],
      command,
      roles,
      usingPredicate: extractClauseExpression(statement, /\busing\s*/iu),
      withCheckPredicate: extractClauseExpression(statement, /\bwith\s+check\s*/iu),
      statement,
    });
  }
  return definitions.sort((a, b) => a.identity.localeCompare(b.identity));
}

function neutralMigrationPolicyIssues(sql, neutralTables) {
  const stripped = stripSqlComments(sql ?? "");
  const issues = [];
  for (const match of stripped.matchAll(/\b(?:create|alter|drop)\s+policy\b[\s\S]*?;/giu)) {
    const statement = normalizeSql(match[0]);
    const neutralTarget = [...neutralTables].find((table) => new RegExp(`\\bon\\s+${escapeRegex(table)}\\b`, "iu").test(statement));
    issues.push(
      issue("sql_policy_alias_readiness_policy_migration_sql_rejected", {
        neutralTarget: neutralTarget ?? null,
        statement,
      }),
    );
  }
  return issues;
}

function buildReadinessRow(stagedRow, sources) {
  const legacyIdentity = splitPolicyIdentity(stagedRow.legacyObject);
  const neutralIdentity = splitPolicyIdentity(stagedRow.newObject);
  const queueEntry = queueEntryFor(stagedRow, sources.queueRows);
  const verificationEntry = verificationEntryFor(stagedRow, sources.verificationSql);
  const securityEntry = securityCoverageEntryFor(stagedRow, sources.securityCoverage);
  const tableAliasEntry = tableAliasEntryFor(neutralIdentity.table, legacyIdentity.table, sources.tableAliases);
  const policyDefinition = sources.policyDefinitionByIdentity.get(stagedRow.legacyObject) ?? null;

  return {
    legacyPolicy: stagedRow.legacyObject,
    neutralPolicy: stagedRow.newObject,
    legacyTable: legacyIdentity.table,
    neutralTable: neutralIdentity.table,
    legacyPolicyName: legacyIdentity.policyName,
    neutralPolicyName: neutralIdentity.policyName,
    owner: stagedRow.owner,
    reason:
      "Neutral SQL table aliases are views, so equivalent neutral RLS policy coverage requires a future forward migration with predicate-equivalence and linked verification evidence.",
    status: "requires_forward_migration",
    statusFromStaging: stagedRow.status,
    blockerClass: POLICY_BLOCKER,
    validationCommand: "npm run check:sql-policy-alias-readiness",
    manualFollowUp:
      stagedRow.manualFollowUp ??
      "Do not add or remove SQL policies until a forward migration can prove predicate equivalence on a neutral table target.",
    queueCovered: Boolean(queueEntry),
    queueStatus: queueEntry?.status ?? null,
    queueValidationCommand: queueEntry?.validationCommand ?? null,
    verificationSqlCovered: Boolean(verificationEntry),
    verificationSql: verificationEntry?.validationSql ?? null,
    sqlSecurityAutomationCovered: Boolean(securityEntry),
    neutralTableViewAliasCovered: Boolean(tableAliasEntry),
    legacyPolicyDefined: Boolean(policyDefinition),
    command: policyDefinition?.command ?? null,
    roles: policyDefinition?.roles ?? [],
    usingPredicate: policyDefinition?.usingPredicate ?? null,
    withCheckPredicate: policyDefinition?.withCheckPredicate ?? null,
    policyMigrationRejectedInThisPass: true,
    futureMigrationRequirement:
      "Create a real neutral table/RLS target or equivalent predicate migration, run linked read-only verification, and keep the legacy policy until queue status is ready_for_removal.",
  };
}

function validateReadinessRow(row) {
  const issues = [];
  for (const key of [
    "legacyPolicy",
    "neutralPolicy",
    "legacyTable",
    "neutralTable",
    "legacyPolicyName",
    "neutralPolicyName",
    "owner",
    "reason",
    "status",
    "blockerClass",
    "validationCommand",
    "manualFollowUp",
    "futureMigrationRequirement",
  ]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("sql_policy_alias_readiness_missing_metadata", { legacyPolicy: row.legacyPolicy ?? null, key }));
    }
  }
  if (row.statusFromStaging === "alias_added") {
    issues.push(issue("sql_policy_alias_readiness_policy_marked_alias_added", { legacyPolicy: row.legacyPolicy }));
  }
  if (row.status !== "requires_forward_migration") {
    issues.push(issue("sql_policy_alias_readiness_policy_not_blocked", { legacyPolicy: row.legacyPolicy, status: row.status }));
  }
  if (row.blockerClass !== POLICY_BLOCKER) {
    issues.push(issue("sql_policy_alias_readiness_wrong_blocker", { legacyPolicy: row.legacyPolicy, blockerClass: row.blockerClass }));
  }
  if (!row.queueCovered) issues.push(issue("sql_policy_alias_readiness_missing_queue_coverage", { legacyPolicy: row.legacyPolicy }));
  if (!row.verificationSqlCovered) issues.push(issue("sql_policy_alias_readiness_missing_verification_sql", { legacyPolicy: row.legacyPolicy }));
  if (!row.sqlSecurityAutomationCovered) {
    issues.push(issue("sql_policy_alias_readiness_missing_security_automation_coverage", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.neutralTableViewAliasCovered) {
    issues.push(
      issue("sql_policy_alias_readiness_missing_neutral_table_view_alias", {
        legacyPolicy: row.legacyPolicy,
        neutralTable: row.neutralTable,
      }),
    );
  }
  if (!row.legacyPolicyDefined) {
    issues.push(issue("sql_policy_alias_readiness_missing_legacy_policy_definition", { legacyPolicy: row.legacyPolicy }));
  }
  if (row.legacyPolicyDefined && !row.command) {
    issues.push(issue("sql_policy_alias_readiness_missing_policy_command", { legacyPolicy: row.legacyPolicy }));
  }
  if (row.legacyPolicyDefined && !row.usingPredicate) {
    issues.push(issue("sql_policy_alias_readiness_missing_using_predicate", { legacyPolicy: row.legacyPolicy }));
  }
  return issues;
}

export function buildSqlPolicyAliasReadiness(root = DEFAULT_ROOT, options = {}) {
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const stagingRel = options.stagingRel ?? DEFAULT_STAGING_REL;
  const tableAliasRel = options.tableAliasRel ?? DEFAULT_TABLE_ALIAS_REL;
  const securityCoverageRel = options.securityCoverageRel ?? DEFAULT_SECURITY_COVERAGE_REL;
  const verificationSqlRel = options.verificationSqlRel ?? DEFAULT_VERIFICATION_SQL_REL;
  const compatibilityQueueRel = options.compatibilityQueueRel ?? DEFAULT_COMPATIBILITY_QUEUE_REL;
  const legacyMigrationRel = options.legacyMigrationRel ?? DEFAULT_LEGACY_MIGRATION_REL;
  const neutralMigrationRel = options.neutralMigrationRel ?? DEFAULT_NEUTRAL_MIGRATION_REL;
  const expectedPolicyRowCount = options.expectedPolicyRowCount ?? EXPECTED_POLICY_ROW_COUNT;

  const staging = options.staging ?? readJson(root, stagingRel, null);
  const tableAliases = options.tableAliases ?? readJson(root, tableAliasRel, null);
  const securityCoverage = options.securityCoverage ?? readJson(root, securityCoverageRel, null);
  const verificationSql = options.verificationSql ?? readJson(root, verificationSqlRel, null);
  const compatibilityQueue = options.compatibilityQueue ?? readJson(root, compatibilityQueueRel, null);
  const legacyMigrationSql = options.legacyMigrationSql ?? readText(root, legacyMigrationRel);
  const neutralMigrationSql = options.neutralMigrationSql ?? readText(root, neutralMigrationRel);
  const issues = [];

  if (!staging) issues.push(issue("sql_policy_alias_readiness_missing_staging", { path: stagingRel }));
  if (!tableAliases) issues.push(issue("sql_policy_alias_readiness_missing_table_aliases", { path: tableAliasRel }));
  if (!securityCoverage) issues.push(issue("sql_policy_alias_readiness_missing_security_coverage", { path: securityCoverageRel }));
  if (!verificationSql) issues.push(issue("sql_policy_alias_readiness_missing_verification_sql_artifact", { path: verificationSqlRel }));
  if (!compatibilityQueue) issues.push(issue("sql_policy_alias_readiness_missing_compatibility_queue", { path: compatibilityQueueRel }));
  if (legacyMigrationSql === null) issues.push(issue("sql_policy_alias_readiness_missing_legacy_migration", { path: legacyMigrationRel }));
  if (neutralMigrationSql === null) issues.push(issue("sql_policy_alias_readiness_missing_neutral_migration", { path: neutralMigrationRel }));

  const policyRows = stagedPolicyRows(staging);
  const definitions = extractPolicyDefinitions(legacyMigrationSql ?? "");
  const policyDefinitionByIdentity = new Map(definitions.map((row) => [row.identity, row]));
  const sources = {
    tableAliases,
    securityCoverage,
    verificationSql,
    queueRows: queueRows(compatibilityQueue),
    policyDefinitionByIdentity,
  };
  const rows = policyRows.map((row) => buildReadinessRow(row, sources));
  const neutralTables = new Set(rows.map((row) => row.neutralTable));

  if (policyRows.length !== expectedPolicyRowCount) {
    issues.push(
      issue("sql_policy_alias_readiness_unexpected_policy_row_count", {
        expected: expectedPolicyRowCount,
        actual: policyRows.length,
      }),
    );
  }
  issues.push(...neutralMigrationPolicyIssues(neutralMigrationSql ?? "", neutralTables));
  issues.push(...rows.flatMap(validateReadinessRow));

  const statusCounts = {};
  const blockerClassCounts = {};
  const commandCounts = {};
  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    blockerClassCounts[row.blockerClass] = (blockerClassCounts[row.blockerClass] ?? 0) + 1;
    if (row.command) commandCounts[row.command] = (commandCounts[row.command] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-sql-policy-alias-readiness.mjs --write",
    policy:
      "Prove staged neutral SQL policy aliases are intentionally blocked because their neutral targets are views. This artifact records predicate evidence and does not authorize policy DDL, linked Supabase verification claims, production migration application, or legacy policy removal.",
    sourceArtifacts: {
      sqlObjectRenameStaging: stagingRel,
      sqlNeutralTableViewAliases: tableAliasRel,
      sqlSecurityAutomationCoverage: securityCoverageRel,
      sqlRenameVerificationSql: verificationSqlRel,
      compatibilityRemovalQueue: compatibilityQueueRel,
      legacyMigration: legacyMigrationRel,
      neutralTableViewMigration: neutralMigrationRel,
    },
    totals: {
      policyRowCount: rows.length,
      aliasAddedCount: rows.filter((row) => row.status === "alias_added").length,
      requiresForwardMigrationCount: rows.filter((row) => row.status === "requires_forward_migration").length,
      queueCoveredCount: rows.filter((row) => row.queueCovered).length,
      verificationSqlCoveredCount: rows.filter((row) => row.verificationSqlCovered).length,
      sqlSecurityAutomationCoveredCount: rows.filter((row) => row.sqlSecurityAutomationCovered).length,
      neutralTableViewAliasCoveredCount: rows.filter((row) => row.neutralTableViewAliasCovered).length,
      legacyPolicyDefinedCount: rows.filter((row) => row.legacyPolicyDefined).length,
      statusCounts: sortedObject(statusCounts),
      blockerClassCounts: sortedObject(blockerClassCounts),
      commandCounts: sortedObject(commandCounts),
      issueCount: issues.length,
    },
    rows,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeSqlPolicyAliasReadiness(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildSqlPolicyAliasReadiness(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push(issue("sql_policy_alias_readiness_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push(
      issue("sql_policy_alias_readiness_artifact_drift", {
        path: artifactRel,
        hint: "Run npm run write:sql-policy-alias-readiness",
      }),
    );
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    policyRowCount: current.totals.policyRowCount,
    requiresForwardMigrationCount: current.totals.requiresForwardMigrationCount,
    blockerClassCounts: current.totals.blockerClassCounts,
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
    tableAliasRel: DEFAULT_TABLE_ALIAS_REL,
    securityCoverageRel: DEFAULT_SECURITY_COVERAGE_REL,
    verificationSqlRel: DEFAULT_VERIFICATION_SQL_REL,
    compatibilityQueueRel: DEFAULT_COMPATIBILITY_QUEUE_REL,
    legacyMigrationRel: DEFAULT_LEGACY_MIGRATION_REL,
    neutralMigrationRel: DEFAULT_NEUTRAL_MIGRATION_REL,
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
    } else if (arg === "--table-aliases") {
      options.tableAliasRel = argv[index + 1] ?? DEFAULT_TABLE_ALIAS_REL;
      index += 1;
    } else if (arg.startsWith("--table-aliases=")) {
      options.tableAliasRel = arg.slice("--table-aliases=".length);
    } else if (arg === "--security-coverage") {
      options.securityCoverageRel = argv[index + 1] ?? DEFAULT_SECURITY_COVERAGE_REL;
      index += 1;
    } else if (arg.startsWith("--security-coverage=")) {
      options.securityCoverageRel = arg.slice("--security-coverage=".length);
    } else if (arg === "--verification-sql") {
      options.verificationSqlRel = argv[index + 1] ?? DEFAULT_VERIFICATION_SQL_REL;
      index += 1;
    } else if (arg.startsWith("--verification-sql=")) {
      options.verificationSqlRel = arg.slice("--verification-sql=".length);
    } else if (arg === "--compatibility-queue") {
      options.compatibilityQueueRel = argv[index + 1] ?? DEFAULT_COMPATIBILITY_QUEUE_REL;
      index += 1;
    } else if (arg.startsWith("--compatibility-queue=")) {
      options.compatibilityQueueRel = arg.slice("--compatibility-queue=".length);
    } else if (arg === "--legacy-migration") {
      options.legacyMigrationRel = argv[index + 1] ?? DEFAULT_LEGACY_MIGRATION_REL;
      index += 1;
    } else if (arg.startsWith("--legacy-migration=")) {
      options.legacyMigrationRel = arg.slice("--legacy-migration=".length);
    } else if (arg === "--neutral-migration") {
      options.neutralMigrationRel = argv[index + 1] ?? DEFAULT_NEUTRAL_MIGRATION_REL;
      index += 1;
    } else if (arg.startsWith("--neutral-migration=")) {
      options.neutralMigrationRel = arg.slice("--neutral-migration=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runSqlPolicyAliasReadiness(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildSqlPolicyAliasReadiness(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          policyRowCount: artifact.totals.policyRowCount,
          blockerClassCounts: artifact.totals.blockerClassCounts,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeSqlPolicyAliasReadiness(options);
  const { current: _current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlPolicyAliasReadiness();
}
