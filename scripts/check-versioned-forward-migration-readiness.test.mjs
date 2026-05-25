import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedForwardMigrationReadiness,
  buildVersionedForwardMigrationReadiness,
} from "./check-versioned-forward-migration-readiness.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-forward-migration-readiness-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function baseRows() {
  const prefix = "v";
  const upperPrefix = "V";
  return [
    {
      legacyObject: `public.claim_${prefix}10_mutation_idempotency`,
      newObject: "public.claim_mutation_idempotency",
      objectType: "function",
      dataBearing: false,
      owner: "database-platform",
      reason: "Neutral function wrapper exists.",
      status: "alias_added",
      validationCommand: "npm run check:sql-rename-verification-sql",
      validationSql: "select true;",
      cutoverStrategy: "Move app references after linked verification.",
      earliestRemovalCondition: "Linked verification and app reference cutover pass.",
      manualFollowUp: "Do not remove the retained SQL object yet.",
    },
    {
      legacyObject: `public.${prefix}10_activation_state`,
      newObject: "public.activation_state",
      objectType: "table",
      dataBearing: true,
      owner: "database-platform",
      reason: "Data-bearing SQL object needs a forward migration.",
      status: "requires_forward_migration",
      validationCommand: "npm run check:sql-object-reference-inventory",
      validationSql: "select true;",
      cutoverStrategy: "Create neutral table or view and backfill.",
      earliestRemovalCondition: "Forward migration and linked verification pass.",
      manualFollowUp: "Do not remove the retained SQL object yet.",
    },
    {
      legacyObject: `public.${prefix}10_activation_state:Members can read ${upperPrefix}10 activation`,
      newObject: "public.activation_state:Members can read activation",
      objectType: "policy",
      dataBearing: false,
      owner: "database-platform",
      reason: "Policy predicate equivalence needs a forward migration.",
      status: "requires_forward_migration",
      validationCommand: "npm run check:sql-object-reference-inventory",
      validationSql: "select true;",
      cutoverStrategy: "Create neutral policy with equivalent predicate.",
      earliestRemovalCondition: "Forward migration and linked verification pass.",
      manualFollowUp: "Do not remove the retained SQL object yet.",
    },
  ];
}

function baseSources(overrides = {}) {
  const rows = baseRows();
  const queueRows = rows.map((row) => ({
    legacyName: row.legacyObject,
    neutralAlias: row.newObject,
    status: row.status,
    validationCommand: row.validationCommand,
  }));
  const verificationRows = rows.map((row) => ({
    legacyObject: row.legacyObject,
    neutralObject: row.newObject,
    objectType: row.objectType,
    validationSql: row.validationSql,
  }));
  return {
    sqlObjectRenameStaging: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: { stagedRenames: rows },
    },
    sqlRenameVerificationSql: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    sqlRenameVerificationSqlCurrent: {
      issueCount: 0,
      issues: [],
      statements: verificationRows,
    },
    sqlSecurityAutomationCoverage: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    sqlPolicyAliasReadiness: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        rows: [
          {
            legacyPolicy: rows[2].legacyObject,
            neutralPolicy: rows[2].newObject,
            status: "requires_forward_migration",
            blockerClass: "neutral_target_is_view_requires_policy_migration",
            neutralTableViewAliasCovered: true,
            legacyPolicyDefined: true,
          },
        ],
      },
    },
    sqlPolicyPredicateEquivalence: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        rows: [
          {
            legacyPolicy: rows[2].legacyObject,
            neutralPolicy: rows[2].newObject,
            status: "requires_forward_migration",
            blockerClass: "neutral_target_is_view_requires_policy_migration",
            linkedVerificationKind: "manual_auth_context_select_comparison",
            authContextRequired: true,
          },
        ],
      },
    },
    sqlPolicyForwardMigrationBlueprint: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        rows: [
          {
            legacyPolicy: rows[2].legacyObject,
            neutralPolicy: rows[2].newObject,
            status: "requires_forward_migration",
            blockerClass: "neutral_target_is_view_requires_policy_migration",
            futureTargetRequirement: "neutral_policy_capable_table_or_equivalent_target_required",
            requiredPredicateEquivalenceLinkedContext: "representative_authenticated_org_member_contexts",
          },
        ],
      },
    },
    compatibilityRemovalQueue: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: { queues: { sqlObjects: queueRows } },
    },
    versionedPublicRuntimeDualRead: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    migrationManifest: {
      latestVersion: "088",
      migrationCount: 88,
      migrations: [{ version: "088", file: "088_sql_neutral_function_aliases.sql" }],
    },
    migrationDomainIndex: {
      latestVersion: "088",
      migrationCount: 88,
      migrations: [{ version: "088", file: "088_sql_neutral_function_aliases.sql" }],
      groups: [{ label: "RLS And Security", files: ["088_sql_neutral_function_aliases.sql"] }],
    },
    localCatalogFingerprint: {
      migrationCount: 88,
      latestMigration: "088_sql_neutral_function_aliases.sql",
    },
    ...overrides,
  };
}

test("forward migration readiness classifies alias-added functions and blocked table/policy rows", () => {
  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources: baseSources() });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.rowCount, 3);
  assert.equal(artifact.totals.statusCounts.alias_added, 1);
  assert.equal(artifact.totals.statusCounts.requires_forward_migration, 2);
  assert.equal(artifact.totals.blockerClassCounts.data_bearing_table_view_or_backfill, 1);
  assert.equal(artifact.totals.blockerClassCounts.neutral_target_is_view_requires_policy_migration, 1);
  assert.equal(artifact.totals.queueCoveredCount, 3);
  assert.equal(artifact.totals.verificationSqlCoveredCount, 3);
  assert.equal(artifact.totals.policyAliasReadinessCoveredCount, 1);
  assert.equal(artifact.totals.policyPredicateEquivalenceCoveredCount, 1);
  assert.equal(artifact.totals.policyForwardMigrationBlueprintCoveredCount, 1);
});

test("forward migration readiness fails when queue coverage is missing", () => {
  const sources = baseSources();
  sources.compatibilityRemovalQueue.current.queues.sqlObjects = sources.compatibilityRemovalQueue.current.queues.sqlObjects.slice(1);

  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_forward_migration_readiness_missing_queue_coverage"));
});

test("forward migration readiness fails when verification SQL is missing", () => {
  const sources = baseSources();
  sources.sqlRenameVerificationSqlCurrent.statements = sources.sqlRenameVerificationSqlCurrent.statements.slice(1);

  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_forward_migration_readiness_missing_verification_sql"));
});

test("forward migration readiness fails when policy alias readiness coverage is missing", () => {
  const sources = baseSources();
  sources.sqlPolicyAliasReadiness.current.rows = [];

  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_forward_migration_readiness_missing_policy_alias_readiness"));
});

test("forward migration readiness fails when policy predicate equivalence coverage is missing", () => {
  const sources = baseSources();
  sources.sqlPolicyPredicateEquivalence.current.rows = [];

  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(
    artifact.issues.some((row) => row.issue === "versioned_forward_migration_readiness_missing_policy_predicate_equivalence"),
  );
});

test("forward migration readiness fails when policy forward-migration blueprint coverage is missing", () => {
  const sources = baseSources();
  sources.sqlPolicyForwardMigrationBlueprint.current.rows = [];

  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(
    artifact.issues.some((row) => row.issue === "versioned_forward_migration_readiness_missing_policy_forward_migration_blueprint"),
  );
});

test("forward migration readiness fails when an alias-added row lacks alias evidence", () => {
  const sources = baseSources();
  sources.sqlObjectRenameStaging.current.stagedRenames[0].validationCommand = "npm run check:sql-object-reference-inventory";

  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(
    artifact.issues.some((row) => row.issue === "versioned_forward_migration_readiness_alias_marked_complete_without_evidence"),
  );
});

test("forward migration readiness fails when migration fingerprint registration is stale", () => {
  const sources = baseSources({ localCatalogFingerprint: { migrationCount: 88, latestMigration: "087_previous.sql" } });

  const artifact = buildVersionedForwardMigrationReadiness(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(
    artifact.issues.some((row) => row.issue === "versioned_forward_migration_readiness_latest_migration_missing_fingerprint_registration"),
  );
});

test("forward migration readiness detects deterministic artifact drift", () => {
  const root = makeRoot();
  const sources = baseSources();
  writeJson(root, "artifacts/compatibility/versioned-forward-migration-readiness.json", { stale: true });

  const report = analyzeVersionedForwardMigrationReadiness({ root, sources });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_forward_migration_readiness_drift"));
});

test("forward migration readiness passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  const sources = baseSources();
  const artifact = buildVersionedForwardMigrationReadiness(root, { sources });
  writeJson(root, "artifacts/compatibility/versioned-forward-migration-readiness.json", artifact);

  const report = analyzeVersionedForwardMigrationReadiness({ root, sources });

  assert.equal(report.ok, true);
});
