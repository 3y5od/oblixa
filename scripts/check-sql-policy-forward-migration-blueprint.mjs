#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeSqlPolicyAliasReadiness } from "./check-sql-policy-alias-readiness.mjs";
import { analyzeSqlPolicyPredicateEquivalence } from "./check-sql-policy-predicate-equivalence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/sql-policy-forward-migration-blueprint.json";
const DEFAULT_SQL_REL = "supabase/sql/policy-forward-migration-blueprint.sql";
const DEFAULT_PREDICATE_EQUIVALENCE_REL = "artifacts/supabase/sql-policy-predicate-equivalence.json";
const DEFAULT_POLICY_READINESS_REL = "artifacts/supabase/sql-policy-alias-readiness.json";
const DEFAULT_STAGING_REL = "artifacts/supabase/sql-object-rename-staging.json";
const DEFAULT_TABLE_ALIAS_REL = "artifacts/supabase/sql-neutral-table-view-aliases.json";
const DEFAULT_SECURITY_COVERAGE_REL = "artifacts/supabase/sql-security-automation-coverage.json";
const DEFAULT_VERIFICATION_SQL_REL = "artifacts/supabase/sql-rename-verification-sql.json";
const DEFAULT_COMPATIBILITY_QUEUE_REL = "artifacts/compatibility/removal-queue.json";

const POLICY_BLOCKER = "neutral_target_is_view_requires_policy_migration";
const FUTURE_TARGET_REQUIREMENT = "neutral_policy_capable_table_or_equivalent_target_required";
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

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/gu, "''")}'`;
}

function rowsFromArtifact(artifact, key) {
  const rows = artifact?.[key];
  return Array.isArray(rows) ? rows : [];
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

function policyReadinessEntryFor(row, readinessRows) {
  return readinessRows.find((entry) => entry.legacyPolicy === row.legacyPolicy && entry.neutralPolicy === row.neutralPolicy);
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

function linkedVerificationContext(row) {
  if (row.linkedVerificationKind === "manual_non_select_policy_placeholder") {
    return "manual_catalog_and_role_context_for_non_select_policy";
  }
  if (row.linkedVerificationKind === "manual_auth_context_select_comparison" || row.authContextRequired) {
    return "representative_authenticated_org_member_contexts";
  }
  return "read_only_legacy_table_vs_neutral_view_row_count_comparison";
}

function buildBlueprintRow(predicateRow, sources) {
  const readinessEntry = policyReadinessEntryFor(predicateRow, sources.policyReadinessRows);
  const queueEntry = queueEntryFor(predicateRow, sources.queueRows);
  const verificationEntry = verificationEntryFor(predicateRow, sources.verificationSql);
  const securityCoverageEntry = securityCoverageEntryFor(predicateRow, sources.securityCoverage);
  const tableAliasEntry = tableAliasEntryFor(predicateRow, sources.tableAliases);
  const stagingEntry = stagedEntryFor(predicateRow, sources.staging);
  return {
    legacyPolicy: predicateRow.legacyPolicy,
    neutralPolicy: predicateRow.neutralPolicy,
    legacyTable: predicateRow.legacyTable,
    neutralTableViewAlias: predicateRow.neutralTable,
    legacyPolicyName: predicateRow.legacyPolicyName,
    neutralPolicyName: predicateRow.neutralPolicyName,
    owner: predicateRow.owner ?? readinessEntry?.owner ?? stagingEntry?.owner ?? "database-platform",
    reason:
      "Neutral SQL policy migration remains blocked because the current neutral table target is a view; this blueprint records future prerequisites without executing policy DDL.",
    status: "requires_forward_migration",
    blockerClass: POLICY_BLOCKER,
    futureTargetRequirement: FUTURE_TARGET_REQUIREMENT,
    requiredPredicateEquivalenceLinkedContext: linkedVerificationContext(predicateRow),
    futureMigrationGate:
      "Add a policy-capable neutral target, run linked read-only predicate-equivalence verification, then create neutral policies in a separate reviewed forward migration.",
    validationCommand: "npm run check:sql-policy-forward-migration-blueprint",
    manualFollowUp:
      predicateRow.manualFollowUp ??
      readinessEntry?.manualFollowUp ??
      stagingEntry?.manualFollowUp ??
      "Keep the retained SQL policy until a later forward migration and linked verification evidence are complete.",
    command: predicateRow.command,
    roles: Array.isArray(predicateRow.roles) ? predicateRow.roles : [],
    normalizedUsingPredicate: predicateRow.legacyUsingPredicate,
    neutralUsingPredicateCandidate: predicateRow.neutralUsingPredicateCandidate,
    normalizedWithCheckPredicate: predicateRow.legacyWithCheckPredicate,
    neutralWithCheckPredicateCandidate: predicateRow.neutralWithCheckPredicateCandidate,
    predicateEquivalenceStatus: predicateRow.status,
    predicateEquivalenceKind: predicateRow.linkedVerificationKind,
    authContextRequired: Boolean(predicateRow.authContextRequired),
    queueCovered: Boolean(queueEntry),
    queueStatus: queueEntry?.status ?? null,
    predicateEquivalenceCovered: predicateRow.status === "requires_forward_migration" && predicateRow.blockerClass === POLICY_BLOCKER,
    policyAliasReadinessCovered: Boolean(readinessEntry),
    verificationSqlCovered: Boolean(verificationEntry),
    verificationSql: verificationEntry?.validationSql ?? null,
    sqlSecurityAutomationCovered: Boolean(securityCoverageEntry),
    neutralTableViewAliasCovered: Boolean(tableAliasEntry),
    neutralTableViewAliasStatus: tableAliasEntry?.status ?? null,
    stagingCovered: Boolean(stagingEntry),
    migratableInThisPass: false,
    policyDdlRejectedInThisPass: true,
    futureDdlPlaceholderCommentOnly: true,
  };
}

function validateBlueprintRow(row) {
  const issues = [];
  for (const key of [
    "legacyPolicy",
    "neutralPolicy",
    "legacyTable",
    "neutralTableViewAlias",
    "owner",
    "reason",
    "status",
    "blockerClass",
    "futureTargetRequirement",
    "requiredPredicateEquivalenceLinkedContext",
    "futureMigrationGate",
    "validationCommand",
    "manualFollowUp",
    "command",
  ]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("sql_policy_forward_migration_blueprint_missing_metadata", { legacyPolicy: row.legacyPolicy ?? null, key }));
    }
  }
  if (row.status !== "requires_forward_migration") {
    issues.push(issue("sql_policy_forward_migration_blueprint_policy_marked_complete", { legacyPolicy: row.legacyPolicy, status: row.status }));
  }
  if (row.blockerClass !== POLICY_BLOCKER) {
    issues.push(issue("sql_policy_forward_migration_blueprint_wrong_blocker", { legacyPolicy: row.legacyPolicy, blockerClass: row.blockerClass }));
  }
  if (row.futureTargetRequirement !== FUTURE_TARGET_REQUIREMENT) {
    issues.push(
      issue("sql_policy_forward_migration_blueprint_missing_policy_capable_target_requirement", {
        legacyPolicy: row.legacyPolicy,
        futureTargetRequirement: row.futureTargetRequirement,
      }),
    );
  }
  if (row.migratableInThisPass !== false) {
    issues.push(issue("sql_policy_forward_migration_blueprint_incorrectly_marked_migratable", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.policyDdlRejectedInThisPass || !row.futureDdlPlaceholderCommentOnly) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_policy_ddl_rejection_evidence", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.queueCovered) issues.push(issue("sql_policy_forward_migration_blueprint_missing_queue_coverage", { legacyPolicy: row.legacyPolicy }));
  if (!row.predicateEquivalenceCovered) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_predicate_equivalence", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.policyAliasReadinessCovered) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_policy_alias_readiness", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.verificationSqlCovered) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_verification_sql", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.sqlSecurityAutomationCovered) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_security_automation_coverage", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.neutralTableViewAliasCovered) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_neutral_table_view_alias", { legacyPolicy: row.legacyPolicy }));
  }
  if (!row.stagingCovered) issues.push(issue("sql_policy_forward_migration_blueprint_missing_staging_row", { legacyPolicy: row.legacyPolicy }));
  if (!row.normalizedUsingPredicate) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_using_predicate", { legacyPolicy: row.legacyPolicy }));
  }
  if (row.command !== "select" && !row.normalizedWithCheckPredicate) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_with_check_predicate", { legacyPolicy: row.legacyPolicy }));
  }
  return issues;
}

function renderBlueprintSqlBlock(row) {
  const lines = [
    `-- Policy forward-migration blueprint: ${row.legacyPolicy}`,
    `-- Neutral policy identity: ${row.neutralPolicy}`,
    `-- Current neutral target is a view: ${row.neutralTableViewAlias}`,
    `-- Required future target: ${row.futureTargetRequirement}`,
    `-- Required linked verification context: ${row.requiredPredicateEquivalenceLinkedContext}`,
    `-- Future migration gate: ${row.futureMigrationGate}`,
    `-- Command: ${row.command}`,
    `-- Roles: ${row.roles.length ? row.roles.join(", ") : "default/public"}`,
    `-- Legacy USING predicate: ${row.normalizedUsingPredicate}`,
    `-- Neutral USING predicate candidate: ${row.neutralUsingPredicateCandidate}`,
  ];
  if (row.normalizedWithCheckPredicate) lines.push(`-- Legacy WITH CHECK predicate: ${row.normalizedWithCheckPredicate}`);
  if (row.neutralWithCheckPredicateCandidate) {
    lines.push(`-- Neutral WITH CHECK predicate candidate: ${row.neutralWithCheckPredicateCandidate}`);
  }
  lines.push("-- FUTURE DDL PLACEHOLDER (comment only; do not execute from this file):");
  lines.push(`-- create policy "${row.neutralPolicyName}"`);
  lines.push("--   on <future policy-capable neutral table>");
  lines.push(`--   for ${row.command}`);
  if (row.roles.length) lines.push(`--   to ${row.roles.join(", ")}`);
  lines.push(`--   using (${row.neutralUsingPredicateCandidate});`);
  if (row.neutralWithCheckPredicateCandidate) lines.push(`--   with check (${row.neutralWithCheckPredicateCandidate});`);
  lines.push("select");
  lines.push(`  ${sqlString(row.legacyPolicy)}::text as legacy_policy,`);
  lines.push(`  ${sqlString(row.neutralPolicy)}::text as neutral_policy,`);
  lines.push(`  ${sqlString(row.status)}::text as blueprint_status,`);
  lines.push(`  ${sqlString(row.blockerClass)}::text as blocker_class,`);
  lines.push(`  ${sqlString(row.futureTargetRequirement)}::text as future_target_requirement,`);
  lines.push(`  ${sqlString(row.requiredPredicateEquivalenceLinkedContext)}::text as required_linked_verification_context,`);
  lines.push(`  ${sqlString(row.validationCommand)}::text as validation_command,`);
  lines.push("  false::boolean as migratable_in_this_pass;");
  return `${lines.join("\n")}\n`;
}

function buildBlueprintSql(rows) {
  const blocks = [
    "-- Generated by scripts/check-sql-policy-forward-migration-blueprint.mjs --write",
    "-- Non-executing SQL policy forward-migration blueprint.",
    "-- This file contains comments and SELECT statements only.",
    "-- It does not create, alter, or drop policies, grant privileges, backfill data, apply migrations, or remove legacy SQL objects.",
    "",
    ...rows.flatMap((row) => [renderBlueprintSqlBlock(row), ""]),
  ];
  return `${blocks.join("\n").trimEnd()}\n`;
}

export function generatedBlueprintSqlIssues(sql) {
  const stripped = stripSqlComments(sql);
  const issues = [];
  for (const pattern of [
    { issue: "sql_policy_forward_migration_blueprint_policy_ddl_rejected", pattern: /\b(?:create|alter|drop)\s+policy\b/iu },
    { issue: "sql_policy_forward_migration_blueprint_sql_object_ddl_rejected", pattern: /\b(?:create|alter|drop)\s+(?:table|view|function|trigger|schema)\b/iu },
    { issue: "sql_policy_forward_migration_blueprint_grant_rejected", pattern: /\b(?:grant|revoke)\b/iu },
    { issue: "sql_policy_forward_migration_blueprint_write_or_backfill_rejected", pattern: /\b(?:insert|update|delete|merge|truncate|copy|backfill)\b/iu },
  ]) {
    if (pattern.pattern.test(stripped)) issues.push(issue(pattern.issue));
  }
  return issues;
}

function sourceIssueSummaries(sources) {
  return [
    ["sql_policy_predicate_equivalence", sources.policyPredicateEquivalenceReport],
    ["sql_policy_alias_readiness", sources.policyAliasReadinessReport],
  ].flatMap(([source, report]) => {
    const issueCount = Number(report?.issueCount ?? report?.issues?.length ?? 0);
    if (issueCount === 0) return [];
    return [
      issue("sql_policy_forward_migration_blueprint_source_issues", {
        source,
        issueCount,
        sampleIssues: (report?.issues ?? []).slice(0, 5),
      }),
    ];
  });
}

export function buildSqlPolicyForwardMigrationBlueprint(root = DEFAULT_ROOT, options = {}) {
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const sqlRel = options.sqlRel ?? DEFAULT_SQL_REL;
  const predicateEquivalenceRel = options.predicateEquivalenceRel ?? DEFAULT_PREDICATE_EQUIVALENCE_REL;
  const policyReadinessRel = options.policyReadinessRel ?? DEFAULT_POLICY_READINESS_REL;
  const stagingRel = options.stagingRel ?? DEFAULT_STAGING_REL;
  const tableAliasRel = options.tableAliasRel ?? DEFAULT_TABLE_ALIAS_REL;
  const securityCoverageRel = options.securityCoverageRel ?? DEFAULT_SECURITY_COVERAGE_REL;
  const verificationSqlRel = options.verificationSqlRel ?? DEFAULT_VERIFICATION_SQL_REL;
  const compatibilityQueueRel = options.compatibilityQueueRel ?? DEFAULT_COMPATIBILITY_QUEUE_REL;
  const expectedPolicyRowCount = options.expectedPolicyRowCount ?? EXPECTED_POLICY_ROW_COUNT;

  const policyPredicateEquivalenceReport =
    options.policyPredicateEquivalenceReport ??
    analyzeSqlPolicyPredicateEquivalence({
      root,
      artifactRel: predicateEquivalenceRel,
      expectedPolicyRowCount,
    });
  const policyAliasReadinessReport =
    options.policyAliasReadinessReport ??
    analyzeSqlPolicyAliasReadiness({
      root,
      artifactRel: policyReadinessRel,
      expectedPolicyRowCount,
    });
  const predicateRows = policyPredicateEquivalenceReport.current?.rows ?? policyPredicateEquivalenceReport.rows ?? [];
  const policyReadinessRows = policyAliasReadinessReport.current?.rows ?? policyAliasReadinessReport.rows ?? [];
  const staging = options.staging ?? readJson(root, stagingRel, null);
  const tableAliases = options.tableAliases ?? readJson(root, tableAliasRel, null);
  const securityCoverage = options.securityCoverage ?? readJson(root, securityCoverageRel, null);
  const verificationSql = options.verificationSql ?? readJson(root, verificationSqlRel, null);
  const compatibilityQueue = options.compatibilityQueue ?? readJson(root, compatibilityQueueRel, null);
  const issues = [];

  if (!staging) issues.push(issue("sql_policy_forward_migration_blueprint_missing_staging", { path: stagingRel }));
  if (!tableAliases) issues.push(issue("sql_policy_forward_migration_blueprint_missing_table_aliases", { path: tableAliasRel }));
  if (!securityCoverage) issues.push(issue("sql_policy_forward_migration_blueprint_missing_security_coverage", { path: securityCoverageRel }));
  if (!verificationSql) issues.push(issue("sql_policy_forward_migration_blueprint_missing_verification_sql_artifact", { path: verificationSqlRel }));
  if (!compatibilityQueue) issues.push(issue("sql_policy_forward_migration_blueprint_missing_compatibility_queue", { path: compatibilityQueueRel }));

  const sources = {
    policyPredicateEquivalenceReport,
    policyAliasReadinessReport,
    policyReadinessRows,
    staging,
    tableAliases,
    securityCoverage,
    verificationSql,
    queueRows: queueRows(compatibilityQueue),
  };
  const rows = predicateRows
    .filter((row) => row.status === "requires_forward_migration" && row.blockerClass === POLICY_BLOCKER)
    .map((row) => buildBlueprintRow(row, sources))
    .sort((a, b) => a.legacyPolicy.localeCompare(b.legacyPolicy));
  const blueprintSql = buildBlueprintSql(rows);

  if (rows.length !== expectedPolicyRowCount) {
    issues.push(
      issue("sql_policy_forward_migration_blueprint_unexpected_policy_row_count", {
        expected: expectedPolicyRowCount,
        actual: rows.length,
      }),
    );
  }
  issues.push(...sourceIssueSummaries(sources));
  issues.push(...rows.flatMap(validateBlueprintRow));
  issues.push(...generatedBlueprintSqlIssues(blueprintSql));

  const statusCounts = {};
  const blockerClassCounts = {};
  const commandCounts = {};
  const linkedContextCounts = {};
  const futureTargetRequirementCounts = {};
  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    blockerClassCounts[row.blockerClass] = (blockerClassCounts[row.blockerClass] ?? 0) + 1;
    commandCounts[row.command] = (commandCounts[row.command] ?? 0) + 1;
    linkedContextCounts[row.requiredPredicateEquivalenceLinkedContext] =
      (linkedContextCounts[row.requiredPredicateEquivalenceLinkedContext] ?? 0) + 1;
    futureTargetRequirementCounts[row.futureTargetRequirement] = (futureTargetRequirementCounts[row.futureTargetRequirement] ?? 0) + 1;
  }

  const artifact = {
    schemaVersion: 1,
    generatedBy: "scripts/check-sql-policy-forward-migration-blueprint.mjs --write",
    policy:
      "Record future SQL policy forward-migration prerequisites for retained policy rows without creating policy DDL, applying migrations, claiming linked verification, or removing legacy SQL objects.",
    sourceArtifacts: {
      sqlPolicyPredicateEquivalence: predicateEquivalenceRel,
      sqlPolicyAliasReadiness: policyReadinessRel,
      sqlObjectRenameStaging: stagingRel,
      sqlNeutralTableViewAliases: tableAliasRel,
      sqlSecurityAutomationCoverage: securityCoverageRel,
      sqlRenameVerificationSql: verificationSqlRel,
      compatibilityRemovalQueue: compatibilityQueueRel,
    },
    generatedSql: {
      path: sqlRel,
      sha256: sha256(blueprintSql),
      policy: "Non-executing blueprint SQL; comments and SELECT statements only.",
    },
    totals: {
      policyRowCount: rows.length,
      statusCounts: sortedObject(statusCounts),
      blockerClassCounts: sortedObject(blockerClassCounts),
      commandCounts: sortedObject(commandCounts),
      requiredPredicateEquivalenceLinkedContextCounts: sortedObject(linkedContextCounts),
      futureTargetRequirementCounts: sortedObject(futureTargetRequirementCounts),
      queueCoveredCount: rows.filter((row) => row.queueCovered).length,
      predicateEquivalenceCoveredCount: rows.filter((row) => row.predicateEquivalenceCovered).length,
      policyAliasReadinessCoveredCount: rows.filter((row) => row.policyAliasReadinessCovered).length,
      verificationSqlCoveredCount: rows.filter((row) => row.verificationSqlCovered).length,
      sqlSecurityAutomationCoveredCount: rows.filter((row) => row.sqlSecurityAutomationCovered).length,
      neutralTableViewAliasCoveredCount: rows.filter((row) => row.neutralTableViewAliasCovered).length,
      stagingCoveredCount: rows.filter((row) => row.stagingCovered).length,
      migratableInThisPassCount: rows.filter((row) => row.migratableInThisPass).length,
      commentOnlyFutureDdlPlaceholderCount: rows.filter((row) => row.futureDdlPlaceholderCommentOnly).length,
      sourceIssueCount: sourceIssueSummaries(sources).length,
      issueCount: issues.length,
    },
    rows,
    issueCount: issues.length,
    issues,
  };

  return { artifact, blueprintSql };
}

export function analyzeSqlPolicyForwardMigrationBlueprint(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const sqlRel = options.sqlRel ?? DEFAULT_SQL_REL;
  const { artifact, blueprintSql } = buildSqlPolicyForwardMigrationBlueprint(root, options);
  const issues = [...artifact.issues];
  const committedArtifact = readJson(root, artifactRel, null);
  const committedSql = readText(root, sqlRel);

  if (!committedArtifact) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(committedArtifact) !== stableStringify(artifact)) {
    issues.push(
      issue("sql_policy_forward_migration_blueprint_artifact_drift", {
        path: artifactRel,
        hint: "Run npm run write:sql-policy-forward-migration-blueprint",
      }),
    );
  }
  if (committedSql === null) {
    issues.push(issue("sql_policy_forward_migration_blueprint_missing_sql", { path: sqlRel }));
  } else if (committedSql !== blueprintSql) {
    issues.push(
      issue("sql_policy_forward_migration_blueprint_sql_drift", {
        path: sqlRel,
        hint: "Run npm run write:sql-policy-forward-migration-blueprint",
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
    requiredPredicateEquivalenceLinkedContextCounts: artifact.totals.requiredPredicateEquivalenceLinkedContextCounts,
    issueCount: issues.length,
    issues,
    current: artifact,
    blueprintSql,
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

export function runSqlPolicyForwardMigrationBlueprint(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const { artifact, blueprintSql } = buildSqlPolicyForwardMigrationBlueprint(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    writeText(options.root, options.sqlRel, blueprintSql);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: [options.artifactRel, options.sqlRel],
          policyRowCount: artifact.totals.policyRowCount,
          requiredPredicateEquivalenceLinkedContextCounts: artifact.totals.requiredPredicateEquivalenceLinkedContextCounts,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeSqlPolicyForwardMigrationBlueprint(options);
  const { current: _current, blueprintSql: _blueprintSql, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlPolicyForwardMigrationBlueprint();
}
