import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  analyzeSupabaseSnapshot,
  parseSupabaseSnapshotRows,
  validateSnapshotSql,
} from "./check-supabase-snapshot-bundle.mjs";

const FIXTURE_DIR = path.join(process.cwd(), "scripts", "fixtures", "supabase-snapshot");

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

test("snapshot SQL bundle stays read-only", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "sql", "read_only_operational_snapshot.sql"), "utf8");
  const report = validateSnapshotSql(sql);

  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test("read-only validator rejects write and role-changing SQL", () => {
  const report = validateSnapshotSql("select 1; grant execute on function public.x() to anon; update public.accounts set name = 'x';");

  assert.equal(report.ok, false);
  assert.equal(report.issues.length, 2);
});

test("parser accepts Supabase CLI rows payload and healthy fixture", () => {
  const rows = parseSupabaseSnapshotRows(fixture("healthy.json"));
  const report = analyzeSupabaseSnapshot(rows, {
    expectedMigrationVersions: ["001", "002"],
    requiredPolicyTables: ["public.accounts"],
  });

  assert.equal(rows.length, 6);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.migrationLedger.latestVersion, "002");
});

test("parser reports missing migration versions with manual follow-up SQL", () => {
  const rows = parseSupabaseSnapshotRows(fixture("missing-migration.json"));
  const report = analyzeSupabaseSnapshot(rows, {
    expectedMigrationVersions: ["001", "002"],
  });

  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "snapshot_missing_migration_versions");
  assert.deepEqual(report.issues[0].missingRemote, ["002"]);
  assert.match(report.manualFollowUpSql[0], /schema_migrations/u);
});

test("parser reports RLS-enabled tables without policies", () => {
  const rows = parseSupabaseSnapshotRows(fixture("missing-policy.json"));
  const report = analyzeSupabaseSnapshot(rows, {
    expectedMigrationVersions: ["001", "002"],
  });

  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "snapshot_rls_table_without_policy");
  assert.equal(report.issues[0].table, "accounts");
  assert.match(report.manualFollowUpSql[0], /pg_policies/u);
});
