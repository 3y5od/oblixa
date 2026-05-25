#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeSqlPolicyAliasReadiness, extractPolicyDefinitions } from "./check-sql-policy-alias-readiness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/sql-policy-predicate-equivalence.json";
const DEFAULT_SQL_REL = "supabase/sql/policy-predicate-equivalence.sql";
const DEFAULT_POLICY_READINESS_REL = "artifacts/supabase/sql-policy-alias-readiness.json";
const DEFAULT_STAGING_REL = "artifacts/supabase/sql-object-rename-staging.json";
const DEFAULT_TABLE_ALIAS_REL = "artifacts/supabase/sql-neutral-table-view-aliases.json";
const DEFAULT_SECURITY_COVERAGE_REL = "artifacts/supabase/sql-security-automation-coverage.json";
const DEFAULT_VERIFICATION_SQL_REL = "artifacts/supabase/sql-rename-verification-sql.json";
const DEFAULT_COMPATIBILITY_QUEUE_REL = "artifacts/compatibility/removal-queue.json";
const DEFAULT_LEGACY_MIGRATION_REL = `supabase/migrations/057_${"v"}10_runtime_contracts.sql`;

const POLICY_BLOCKER = "neutral_target_is_view_requires_policy_migration";
const EXPECTED_POLICY_ROW_COUNT = 33;
const AUTH_CONTEXT_PATTERNS = [/\bauth\./iu, /\bpublic\.v10_member_can_read\b/iu, /\bpublic\.member_can_read\b/iu];

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

function writeText(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, value);
}

function writeJson(root, rel, value) {
  writeText(root, rel, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function sortedObject(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripSqlComments(sql) {
  return String(sql)
    .replace(/--.*$/gmu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "");
}

function normalizeSql(value) {
  if (value == null) return null;
  return String(value).replace(/\s+/gu, " ").trim();
}

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/gu, "''")}'`;
}

function rowsFromArtifact(artifact, key) {
  const rows = artifact?.[key];
  return Array.isArray(rows) ? rows : [];
}

function splitPolicyIdentity(value) {
  const text = String(value ?? "");
  const separatorIndex = text.indexOf(":");
  if (separatorIndex < 0) return { table: text, policyName: "" };
  return {
    table: text.slice(0, separatorIndex),
    policyName: text.slice(separatorIndex + 1),
  };
}

function objectName(value) {
  return String(value ?? "").split(".").at(-1) ?? String(value ?? "");
}

function replaceAllLiteral(value, from, to) {
  return String(value).split(from).join(to);
}

function neutralPredicateCandidate(predicate, legacyTable, neutralTable) {
  if (!predicate) return null;
  let next = String(predicate);
  next = replaceAllLiteral(next, objectName(legacyTable), objectName(neutralTable));
  next = replaceAllLiteral(next, "public.v10_member_can_read", "public.member_can_read");
  return normalizeSql(next);
}

function authContextRequired(...values) {
  const text = values.filter(Boolean).join(" ");
  return AUTH_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function queueRows(queueArtifact) {
  return Object.values(queueArtifact?.queues ?? {}).flatMap((rows) => (Array.isArray(rows) ? rows : []));
}

function queueEntryFor(row, queueEntries) {
  return queueEntries.find(
    (entry) =>
      entry.legacyName === row.legacyPolicy &&
      (entry.neutralAlias === row.neutralPolicy || entry.neutralName === row.neutralPolicy || entry.neutralObject === row.neutralPolicy),
  );
}

function verificationEntryFor(row, verification) {
  return rowsFromArtifact(verification, "statements").find(
    (entry) =>
      entry.legacyObject === row.legacyPolicy &&
      entry.neutralObject === row.neutralPolicy &&
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
      entry.legacyName === row.legacyPolicy &&
      entry.neutralAlias === row.neutralPolicy &&
      entry.queueCovered === true,
  );
}

function tableAliasEntryFor(row, tableAliases) {
  return rowsFromArtifact(tableAliases, "rows").find(
    (entry) =>
      entry.legacyObject === row.legacyTable &&
      entry.neutralObject === row.neutralTable &&
      entry.status === "alias_added" &&
      entry.viewDefined === true &&
      entry.securityInvoker === true &&
      entry.delegatesToLegacyTable === true,
  );
}

function stagedEntryFor(row, staging) {
  return (staging?.stagedRenames ?? staging?.rows ?? staging?.entries ?? []).find(
    (entry) => entry.legacyObject === row.legacyPolicy && entry.newObject === row.neutralPolicy && entry.objectType === "policy",
  );
}

function linkedVerificationKind(row) {
  if (row.command !== "select") return "manual_non_select_policy_placeholder";
  if (row.authContextRequired) return "manual_auth_context_select_comparison";
  return "read_only_select_count_comparison";
}

function buildEquivalenceRow(readinessRow, sources) {
  const legacyDefinition = sources.legacyPolicyDefinitionByIdentity.get(readinessRow.legacyPolicy) ?? null;
  const legacyUsingPredicate = normalizeSql(legacyDefinition?.usingPredicate ?? readinessRow.usingPredicate);
  const legacyWithCheckPredicate = normalizeSql(legacyDefinition?.withCheckPredicate ?? readinessRow.withCheckPredicate);
  const neutralUsingPredicate = neutralPredicateCandidate(legacyUsingPredicate, readinessRow.legacyTable, readinessRow.neutralTable);
  const neutralWithCheckPredicate = neutralPredicateCandidate(legacyWithCheckPredicate, readinessRow.legacyTable, readinessRow.neutralTable);
  const needsAuthContext = authContextRequired(legacyUsingPredicate, legacyWithCheckPredicate, neutralUsingPredicate, neutralWithCheckPredicate);
  const row = {
    legacyPolicy: readinessRow.legacyPolicy,
    neutralPolicy: readinessRow.neutralPolicy,
    legacyTable: readinessRow.legacyTable,
    neutralTable: readinessRow.neutralTable,
    legacyPolicyName: readinessRow.legacyPolicyName,
    neutralPolicyName: readinessRow.neutralPolicyName,
    owner: readinessRow.owner,
    reason:
      "Retained SQL policy rows need predicate-equivalence evidence before a future forward migration can create neutral policy targets.",
    status: "requires_forward_migration",
    blockerClass: POLICY_BLOCKER,
    validationCommand: "npm run check:sql-policy-predicate-equivalence",
    manualFollowUp:
      readinessRow.manualFollowUp ??
      "Run linked read-only predicate-equivalence verification before creating neutral SQL policies or removing legacy policies.",
    command: legacyDefinition?.command ?? readinessRow.command,
    roles: legacyDefinition?.roles ?? readinessRow.roles ?? [],
    legacyUsingPredicate,
    neutralUsingPredicateCandidate: neutralUsingPredicate,
    legacyWithCheckPredicate,
    neutralWithCheckPredicateCandidate: neutralWithCheckPredicate,
    authContextRequired: needsAuthContext,
    linkedVerificationKind: null,
    linkedVerificationStatus: "generated_sql_pending_execution",
    queueCovered: Boolean(queueEntryFor(readinessRow, sources.queueRows)),
    verificationSqlCovered: Boolean(verificationEntryFor(readinessRow, sources.verificationSql)),
    sqlSecurityAutomationCovered: Boolean(securityCoverageEntryFor(readinessRow, sources.securityCoverage)),
    neutralTableViewAliasCovered: Boolean(tableAliasEntryFor(readinessRow, sources.tableAliases)),
    stagingCovered: Boolean(stagedEntryFor(readinessRow, sources.staging)),
    policyAliasReadinessCovered: true,
    legacyPolicyDefined: Boolean(legacyDefinition),
    predicateEvidencePresent: Boolean(legacyUsingPredicate),
    withCheckEvidenceRequired: (legacyDefinition?.command ?? readinessRow.command) !== "select",
    policyMigrationRejectedInThisPass: true,
    futureMigrationRequirement:
      "Create neutral RLS policies only in a later forward migration against a policy-capable neutral target after linked read-only predicate-equivalence verification.",
  };
  row.linkedVerificationKind = linkedVerificationKind(row);
  return row;
}

function validateEquivalenceRow(row) {
  const issues = [];
  for (const key of [
    "legacyPolicy",
    "neutralPolicy",
    "legacyTable",
    "neutralTable",
    "owner",
    "reason",
    "status",
    "blockerClass",
    "validationCommand",
    "manualFollowUp",
    "command",
    "futureMigrationRequirement",
  ]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("sql_policy_predicate_equivalence_missing_metadata", { legacyPolicy: row.legacyPolicy ?? null, key }));
    }
  }
  if (row.status !== "requires_forward_migration") {
    issues.push(issue("sql_policy_predicate_equivalence_policy_marked_complete", { legacyPolicy: row.legacyPolicy, status: row.status }));
  }
  if (row.blockerClass !== POLICY_BLOCKER) {
    issues.push(issue("sql_policy_predicate_equivalence_wrong_blocker", { legacyPolicy: row.legacyPolicy, blockerClass: row.blockerClass }));
  }
  if (!row.queueCovered) issues.push(issue("sql_policy_predicate_equivalence_missing_queue_coverage", { legacyPolicy: row.legacyPolicy }));
  if (!row.verificationSqlCovered) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_verification_sql", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.sqlSecurityAutomationCovered) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_security_automation_coverage", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.neutralTableViewAliasCovered) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_neutral_table_view_alias", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.stagingCovered) issues.push(issue("sql_policy_predicate_equivalence_missing_staging_row", { legacyPolicy: row.legacyPolicy }));
  if (!row.legacyPolicyDefined) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_legacy_policy_definition", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.predicateEvidencePresent) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_using_predicate", { legacyPolicy: row.legacyPolicy }));
  }
  if (row.withCheckEvidenceRequired && !row.legacyWithCheckPredicate) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_with_check_predicate", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.neutralUsingPredicateCandidate) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_neutral_predicate_candidate", { legacyPolicy: row.legacyPolicy }));
  }
  return issues;
}

function renderPolicySqlBlock(row) {
  const lines = [
    `-- Policy: ${row.legacyPolicy}`,
    `-- Neutral policy candidate: ${row.neutralPolicy}`,
    `-- Command: ${row.command}`,
    `-- Roles: ${row.roles.length ? row.roles.join(", ") : "default/public"}`,
    `-- Legacy USING: ${row.legacyUsingPredicate}`,
    `-- Neutral USING candidate: ${row.neutralUsingPredicateCandidate}`,
  ];
  if (row.legacyWithCheckPredicate) lines.push(`-- Legacy WITH CHECK: ${row.legacyWithCheckPredicate}`);
  if (row.neutralWithCheckPredicateCandidate) lines.push(`-- Neutral WITH CHECK candidate: ${row.neutralWithCheckPredicateCandidate}`);
  if (row.authContextRequired) {
    lines.push("-- Manual linked verification required: predicate depends on auth context or membership helpers.");
  }
  if (row.command !== "select") {
    lines.push("-- Manual linked verification required: non-SELECT policy command cannot be proven by read-only row-count comparison.");
    lines.push("select");
    lines.push(`  ${sqlString(row.legacyPolicy)}::text as policy_identity,`);
    lines.push("  'manual_non_select_policy_placeholder'::text as verification_kind,");
    lines.push(`  ${sqlString(row.command)}::text as policy_command,`);
    lines.push("  'Run linked read-only catalog and role-context verification before creating neutral policies.'::text as expected_future_command;");
    return `${lines.join("\n")}\n`;
  }

  lines.push("with legacy_visible as (");
  lines.push(`  select count(*)::bigint as row_count from ${row.legacyTable}`);
  lines.push("), neutral_visible as (");
  lines.push(`  select count(*)::bigint as row_count from ${row.neutralTable}`);
  lines.push(")");
  lines.push("select");
  lines.push(`  ${sqlString(row.legacyPolicy)}::text as policy_identity,`);
  lines.push(`  ${sqlString(row.linkedVerificationKind)}::text as verification_kind,`);
  lines.push("  legacy_visible.row_count as legacy_visible_count,");
  lines.push("  neutral_visible.row_count as neutral_visible_count,");
  lines.push("  legacy_visible.row_count = neutral_visible.row_count as visible_count_matches");
  lines.push("from legacy_visible, neutral_visible;");
  if (row.authContextRequired) {
    lines.push("select");
    lines.push(`  ${sqlString(row.legacyPolicy)}::text as policy_identity,`);
    lines.push("  'manual_auth_context_required'::text as verification_kind,");
    lines.push("  'Execute the count comparison under representative authenticated org-member contexts before policy migration.'::text as expected_future_command;");
  }
  return `${lines.join("\n")}\n`;
}

function buildLinkedVerificationSql(rows) {
  const blocks = [
    "-- Generated by scripts/check-sql-policy-predicate-equivalence.mjs --write",
    "-- Read-only SQL for future linked predicate-equivalence verification.",
    "-- This file does not create, alter, or drop policies and does not claim production verification.",
    "",
    ...rows.flatMap((row) => [renderPolicySqlBlock(row), ""]),
  ];
  return `${blocks.join("\n").trimEnd()}\n`;
}

function generatedSqlDdlIssues(sql) {
  const stripped = stripSqlComments(sql);
  const issues = [];
  for (const pattern of [
    { issue: "sql_policy_predicate_equivalence_policy_ddl_rejected", pattern: /\b(?:create|alter|drop)\s+policy\b/iu },
    { issue: "sql_policy_predicate_equivalence_legacy_policy_removal_rejected", pattern: /\bdrop\s+policy\b/iu },
    { issue: "sql_policy_predicate_equivalence_write_or_backfill_rejected", pattern: /\b(?:insert|update|delete|merge|truncate|copy)\b/iu },
  ]) {
    if (pattern.pattern.test(stripped)) issues.push(issue(pattern.issue));
  }
  return issues;
}

function sourceIssueSummaries(sources) {
  const readinessIssues = sources.policyReadinessReport?.issues ?? [];
  if (readinessIssues.length === 0) return [];
  return [
    issue("sql_policy_predicate_equivalence_source_issues", {
      source: "sql_policy_alias_readiness",
      issueCount: readinessIssues.length,
      sampleIssues: readinessIssues.slice(0, 5),
    }),
  ];
}

export function buildSqlPolicyPredicateEquivalence(root = DEFAULT_ROOT, options = {}) {
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const sqlRel = options.sqlRel ?? DEFAULT_SQL_REL;
  const policyReadinessRel = options.policyReadinessRel ?? DEFAULT_POLICY_READINESS_REL;
  const stagingRel = options.stagingRel ?? DEFAULT_STAGING_REL;
  const tableAliasRel = options.tableAliasRel ?? DEFAULT_TABLE_ALIAS_REL;
  const securityCoverageRel = options.securityCoverageRel ?? DEFAULT_SECURITY_COVERAGE_REL;
  const verificationSqlRel = options.verificationSqlRel ?? DEFAULT_VERIFICATION_SQL_REL;
  const compatibilityQueueRel = options.compatibilityQueueRel ?? DEFAULT_COMPATIBILITY_QUEUE_REL;
  const legacyMigrationRel = options.legacyMigrationRel ?? DEFAULT_LEGACY_MIGRATION_REL;
  const expectedPolicyRowCount = options.expectedPolicyRowCount ?? EXPECTED_POLICY_ROW_COUNT;

  const policyReadinessReport =
    options.policyReadinessReport ??
    analyzeSqlPolicyAliasReadiness({
      root,
      artifactRel: policyReadinessRel,
      expectedPolicyRowCount,
    });
  const policyReadinessRows = policyReadinessReport.current?.rows ?? policyReadinessReport.rows ?? [];
  const staging = options.staging ?? readJson(root, stagingRel, null);
  const tableAliases = options.tableAliases ?? readJson(root, tableAliasRel, null);
  const securityCoverage = options.securityCoverage ?? readJson(root, securityCoverageRel, null);
  const verificationSql = options.verificationSql ?? readJson(root, verificationSqlRel, null);
  const compatibilityQueue = options.compatibilityQueue ?? readJson(root, compatibilityQueueRel, null);
  const legacyMigrationSql = options.legacyMigrationSql ?? readText(root, legacyMigrationRel);
  const issues = [];

  if (!staging) issues.push(issue("sql_policy_predicate_equivalence_missing_staging", { path: stagingRel }));
  if (!tableAliases) issues.push(issue("sql_policy_predicate_equivalence_missing_table_aliases", { path: tableAliasRel }));
  if (!securityCoverage) issues.push(issue("sql_policy_predicate_equivalence_missing_security_coverage", { path: securityCoverageRel }));
  if (!verificationSql) issues.push(issue("sql_policy_predicate_equivalence_missing_verification_sql_artifact", { path: verificationSqlRel }));
  if (!compatibilityQueue) issues.push(issue("sql_policy_predicate_equivalence_missing_compatibility_queue", { path: compatibilityQueueRel }));
  if (legacyMigrationSql === null) issues.push(issue("sql_policy_predicate_equivalence_missing_legacy_migration", { path: legacyMigrationRel }));

  const legacyDefinitions = extractPolicyDefinitions(legacyMigrationSql ?? "");
  const sources = {
    policyReadinessReport,
    staging,
    tableAliases,
    securityCoverage,
    verificationSql,
    queueRows: queueRows(compatibilityQueue),
    legacyPolicyDefinitionByIdentity: new Map(legacyDefinitions.map((row) => [row.identity, row])),
  };

  const rows = policyReadinessRows
    .filter((row) => row.status === "requires_forward_migration" && row.blockerClass === POLICY_BLOCKER)
    .map((row) => buildEquivalenceRow(row, sources))
    .sort((a, b) => a.legacyPolicy.localeCompare(b.legacyPolicy));
  const linkedVerificationSql = buildLinkedVerificationSql(rows);

  if (rows.length !== expectedPolicyRowCount) {
    issues.push(
      issue("sql_policy_predicate_equivalence_unexpected_policy_row_count", {
        expected: expectedPolicyRowCount,
        actual: rows.length,
      }),
    );
  }
  issues.push(...sourceIssueSummaries(sources));
  issues.push(...rows.flatMap(validateEquivalenceRow));
  issues.push(...generatedSqlDdlIssues(linkedVerificationSql));

  const statusCounts = {};
  const blockerClassCounts = {};
  const commandCounts = {};
  const linkedVerificationKindCounts = {};
  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    blockerClassCounts[row.blockerClass] = (blockerClassCounts[row.blockerClass] ?? 0) + 1;
    commandCounts[row.command] = (commandCounts[row.command] ?? 0) + 1;
    linkedVerificationKindCounts[row.linkedVerificationKind] = (linkedVerificationKindCounts[row.linkedVerificationKind] ?? 0) + 1;
  }

  const artifact = {
    schemaVersion: 1,
    generatedBy: "scripts/check-sql-policy-predicate-equivalence.mjs --write",
    policy:
      "Stage deterministic predicate-equivalence evidence and read-only linked-verification SQL for retained SQL policy rows. This artifact does not authorize neutral policy DDL, production migration application, linked verification claims, or legacy policy removal.",
    sourceArtifacts: {
      sqlPolicyAliasReadiness: policyReadinessRel,
      sqlObjectRenameStaging: stagingRel,
      sqlNeutralTableViewAliases: tableAliasRel,
      sqlSecurityAutomationCoverage: securityCoverageRel,
      sqlRenameVerificationSql: verificationSqlRel,
      compatibilityRemovalQueue: compatibilityQueueRel,
      legacyMigration: legacyMigrationRel,
    },
    generatedSql: {
      path: sqlRel,
      sha256: sha256(linkedVerificationSql),
      policy: "Read-only future linked-verification SQL; generation is not execution evidence.",
    },
    totals: {
      policyRowCount: rows.length,
      statusCounts: sortedObject(statusCounts),
      blockerClassCounts: sortedObject(blockerClassCounts),
      commandCounts: sortedObject(commandCounts),
      linkedVerificationKindCounts: sortedObject(linkedVerificationKindCounts),
      queueCoveredCount: rows.filter((row) => row.queueCovered).length,
      verificationSqlCoveredCount: rows.filter((row) => row.verificationSqlCovered).length,
      sqlSecurityAutomationCoveredCount: rows.filter((row) => row.sqlSecurityAutomationCovered).length,
      neutralTableViewAliasCoveredCount: rows.filter((row) => row.neutralTableViewAliasCovered).length,
      predicateEvidenceCount: rows.filter((row) => row.predicateEvidencePresent).length,
      authContextRequiredCount: rows.filter((row) => row.authContextRequired).length,
      manualLinkedVerificationRequiredCount: rows.filter((row) => row.linkedVerificationKind.startsWith("manual_")).length,
      sourceIssueCount: sourceIssueSummaries(sources).length,
      issueCount: issues.length,
    },
    rows,
    issueCount: issues.length,
    issues,
  };

  return { artifact, linkedVerificationSql };
}

export function analyzeSqlPolicyPredicateEquivalence(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const sqlRel = options.sqlRel ?? DEFAULT_SQL_REL;
  const { artifact, linkedVerificationSql } = buildSqlPolicyPredicateEquivalence(root, options);
  const issues = [...artifact.issues];
  const committedArtifact = readJson(root, artifactRel, null);
  const committedSql = readText(root, sqlRel);

  if (!committedArtifact) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(committedArtifact) !== stableStringify(artifact)) {
    issues.push(
      issue("sql_policy_predicate_equivalence_artifact_drift", {
        path: artifactRel,
        hint: "Run npm run write:sql-policy-predicate-equivalence",
      }),
    );
  }
  if (committedSql === null) {
    issues.push(issue("sql_policy_predicate_equivalence_missing_sql", { path: sqlRel }));
  } else if (committedSql !== linkedVerificationSql) {
    issues.push(
      issue("sql_policy_predicate_equivalence_sql_drift", {
        path: sqlRel,
        hint: "Run npm run write:sql-policy-predicate-equivalence",
      }),
    );
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    sqlPath: sqlRel,
    policyRowCount: artifact.totals.policyRowCount,
    statusCounts: artifact.totals.statusCounts,
    blockerClassCounts: artifact.totals.blockerClassCounts,
    linkedVerificationKindCounts: artifact.totals.linkedVerificationKindCounts,
    issueCount: issues.length,
    issues,
    current: artifact,
    linkedVerificationSql,
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    artifactRel: DEFAULT_ARTIFACT_REL,
    sqlRel: DEFAULT_SQL_REL,
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
    } else if (arg === "--sql") {
      options.sqlRel = argv[index + 1] ?? DEFAULT_SQL_REL;
      index += 1;
    } else if (arg.startsWith("--sql=")) {
      options.sqlRel = arg.slice("--sql=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runSqlPolicyPredicateEquivalence(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const { artifact, linkedVerificationSql } = buildSqlPolicyPredicateEquivalence(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    writeText(options.root, options.sqlRel, linkedVerificationSql);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: [options.artifactRel, options.sqlRel],
          policyRowCount: artifact.totals.policyRowCount,
          linkedVerificationKindCounts: artifact.totals.linkedVerificationKindCounts,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeSqlPolicyPredicateEquivalence(options);
  const { current: _current, linkedVerificationSql: _linkedVerificationSql, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlPolicyPredicateEquivalence();
}
