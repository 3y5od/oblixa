import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyzeVersionedExportDownloadContracts, buildVersionedExportDownloadContracts } from "./check-versioned-export-download-contracts.mjs";
import { buildSqlRenameVerificationSql } from "./check-sql-rename-verification-sql.mjs";
import { buildSqlSecurityAutomationCoverage } from "./check-sql-security-automation-coverage.mjs";
import { buildMigrationHistoryVersionExceptions } from "./check-migration-history-version-exceptions.mjs";
import { buildSeedVersionedNameQueueCoverage } from "./check-seed-versioned-name-queue-coverage.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-versioned-closure-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, value);
}

function contentContract(overrides = {}) {
  return {
    path: "src/lib/report-export.ts",
    surfaceClass: "download_contract",
    subSurfaceClass: "notification_or_export_contract",
    contractName: "v10-report.csv",
    owner: "reports-platform",
    reason: "Download filename remains queued during compatibility.",
    manualOnly: true,
    removalStrategy: "add_alias_or_queue_then_manual_cutover",
    validationCommand: "npm run check:export-security-guards",
    manualFollowUp: "Keep legacy filename until consumers migrate.",
    suggestedNeutralName: "report.csv",
    count: 1,
    ...overrides,
  };
}

function compatibilityQueue(rows = []) {
  return {
    schemaVersion: 1,
    queues: {
      contentContractAliases: rows,
      sqlObjects: rows,
    },
  };
}

test("versioned export/download contracts require queue coverage for manual rows", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    contracts: [contentContract()],
  });
  writeJson(
    root,
    "artifacts/compatibility/removal-queue.json",
    compatibilityQueue([
      {
        surface: "download_contract",
        subSurface: "notification_or_export_contract",
        legacyName: "v10-report.csv",
        neutralAlias: "report.csv",
        sourcePath: "src/lib/report-export.ts",
      },
    ]),
  );

  const artifact = buildVersionedExportDownloadContracts(root);
  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.contractCount, 1);
  assert.equal(artifact.queueCoveredManualCount, 1);

  writeJson(root, "artifacts/compatibility/versioned-export-download-contracts.json", artifact);
  assert.equal(analyzeVersionedExportDownloadContracts({ root }).ok, true);
});

test("versioned export/download contracts fail unqueued manual rows", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    contracts: [contentContract()],
  });
  writeJson(root, "artifacts/compatibility/removal-queue.json", compatibilityQueue([]));

  const artifact = buildVersionedExportDownloadContracts(root);
  assert.equal(artifact.issueCount, 1);
  assert.equal(artifact.issues[0].issue, "versioned_export_download_manual_row_unqueued");
});

test("SQL rename verification SQL preserves read-only statements and flags mutations", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", {
    stagedRenames: [
      {
        legacyObject: "public.v10_member_can_read",
        newObject: "public.member_can_read",
        objectType: "function",
        dataBearing: false,
        owner: "database-platform",
        status: "staged_manual_cutover",
        validationCommand: "npm run check:sql-object-reference-inventory",
        validationSql: "select to_regproc('public.v10_member_can_read') is not null;",
        cutoverStrategy: "Create neutral alias first.",
        manualFollowUp: "Do not drop legacy object.",
      },
      {
        legacyObject: "public.bad_v10_table",
        newObject: "public.bad_table",
        objectType: "table",
        dataBearing: true,
        owner: "database-platform",
        status: "staged_manual_cutover",
        validationCommand: "npm run check:sql-object-reference-inventory",
        validationSql: "drop table public.bad_v10_table;",
        cutoverStrategy: "Never mutate during verification.",
        manualFollowUp: "Fix verification SQL.",
      },
    ],
  });

  const artifact = buildSqlRenameVerificationSql(root);
  assert.equal(artifact.statementCount, 2);
  assert.match(artifact.combinedSql, /public\.v10_member_can_read/u);
  assert.equal(artifact.issues.some((issue) => issue.issue === "sql_rename_verification_not_read_only"), true);
});

test("SQL security automation coverage joins content inventory, staging, and queue metadata", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    contracts: [
      contentContract({
        path: "supabase/migrations/057_v10_runtime_contracts.sql",
        surfaceClass: "sql_object",
        subSurfaceClass: "sql_security_object",
        contractName: "Members can read V10 audit",
        owner: "database-platform",
        validationCommand: "npm run check:sql-security-migrations-bundle",
        suggestedNeutralName: "Members can read audit",
      }),
    ],
  });
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", {
    stagedRenames: [
      {
        legacyObject: "public.v10_member_can_read",
        newObject: "public.member_can_read",
        objectType: "function",
        dataBearing: false,
        owner: "database-platform",
        reason: "Versioned helper staged for alias.",
        status: "staged_manual_cutover",
        validationCommand: "npm run check:sql-object-reference-inventory",
        validationSql: "select to_regproc('public.v10_member_can_read') is not null;",
        manualFollowUp: "Keep old helper until linked verification passes.",
      },
    ],
  });
  writeJson(
    root,
    "artifacts/compatibility/removal-queue.json",
    compatibilityQueue([
      { surface: "sql_object", legacyName: "Members can read V10 audit", neutralAlias: "Members can read audit", sourcePath: "supabase/migrations/057_v10_runtime_contracts.sql" },
      { surface: "sql_object", legacyName: "public.v10_member_can_read", neutralAlias: "public.member_can_read", sourcePath: "artifacts/supabase/sql-object-rename-staging.json" },
    ]),
  );

  const artifact = buildSqlSecurityAutomationCoverage(root);
  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.coverageCount, 2);
  assert.equal(artifact.queueCoveredCount, 2);
});

test("migration history exceptions classify versioned migration filenames as ledger evidence", () => {
  const root = makeRoot();
  writeText(root, "supabase/migrations/001_init.sql", "select 1;\n");
  writeText(root, "supabase/migrations/014_v2_example.sql", "select 1;\n");
  writeText(root, "supabase/migrations/057_v10_runtime_contracts.sql", "select 1;\n");

  const artifact = buildMigrationHistoryVersionExceptions(root);
  assert.equal(artifact.issueCount, 0);
  assert.deepEqual(
    artifact.exceptions.map((row) => row.migrationFile),
    ["014_v2_example.sql", "057_v10_runtime_contracts.sql"],
  );
  assert.equal(artifact.exceptions[0].classification, "immutable_migration_ledger_evidence");
});

test("seed versioned-name coverage requires manual seed rows to be queued", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    contracts: [
      contentContract({
        path: "supabase/seed.sql",
        surfaceClass: "sql_object",
        subSurfaceClass: "seed_fixture_key",
        contractName: "v6_org_settings_json",
        owner: "database-platform",
        validationCommand: "npm run check:supabase:seed-safety",
        suggestedNeutralName: "org_settings_json",
      }),
    ],
  });
  writeJson(
    root,
    "artifacts/compatibility/removal-queue.json",
    compatibilityQueue([
      {
        surface: "sql_object",
        subSurface: "seed_fixture_key",
        legacyName: "v6_org_settings_json",
        neutralAlias: "org_settings_json",
        sourcePath: "supabase/seed.sql",
      },
    ]),
  );

  const artifact = buildSeedVersionedNameQueueCoverage(root);
  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.seedContractCount, 1);
  assert.equal(artifact.queueCoveredManualCount, 1);
});
