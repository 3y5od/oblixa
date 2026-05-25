import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeMigrationManifest,
  buildMigrationManifest,
  classifyMigration,
} from "./check-migration-manifest.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "migration-manifest-"));
}

function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function writeMigration(root, name, sql = "create table if not exists public.example (id uuid primary key);\n") {
  writeFile(root, `supabase/migrations/${name}`, sql);
}

function writeManifest(root, manifest = buildMigrationManifest(root)) {
  writeFile(root, "artifacts/supabase/migration-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
}

test("classifyMigration marks policy-changing SQL as security follow-up work", () => {
  const classification = classifyMigration({
    file: "001_security_hardening.sql",
    sql: `
      alter table public.accounts enable row level security;
      create policy "Members can read accounts" on public.accounts for select using (true);
    `,
  });

  assert.equal(classification.domain, "security");
  assert.equal(classification.changeType, "policy-changing");
  assert.equal(classification.riskLevel, "medium");
  assert.equal(classification.deployWindowSafe, true);
  assert.equal(classification.requiresFollowUpVerification, true);
});

test("valid manifest matches migration files", () => {
  const root = makeRoot();
  writeMigration(root, "001_initial_schema.sql");
  writeMigration(root, "002_performance_indexes.sql", "create index if not exists idx_example_id on public.example (id);\n");
  writeManifest(root);

  const report = analyzeMigrationManifest({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.migrationCount, 2);
  assert.equal(report.latestVersion, "002");
});

test("missing manifest entry fails for new migration files", () => {
  const root = makeRoot();
  writeMigration(root, "001_initial_schema.sql");
  writeManifest(root);
  writeMigration(root, "002_saved_views.sql");

  const report = analyzeMigrationManifest({ root });
  const codes = report.issues.map((row) => row.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("missing_migration_manifest_entry"));
  assert.ok(codes.includes("migration_manifest_drift"));
});

test("duplicate and stale manifest rows fail", () => {
  const root = makeRoot();
  writeMigration(root, "001_initial_schema.sql");
  const manifest = buildMigrationManifest(root);
  manifest.migrations.push({ ...manifest.migrations[0] });
  manifest.migrations.push({
    ...manifest.migrations[0],
    version: "002",
    file: "002_deleted_migration.sql",
    slug: "deleted_migration",
  });
  writeManifest(root, manifest);

  const report = analyzeMigrationManifest({ root });
  const codes = report.issues.map((row) => row.code).sort();

  assert.equal(report.ok, false);
  assert.ok(codes.includes("duplicate_migration_manifest_file"));
  assert.ok(codes.includes("duplicate_migration_manifest_version"));
  assert.ok(codes.includes("stale_migration_manifest_entry"));
});

test("changed migration hash fails until manifest is regenerated", () => {
  const root = makeRoot();
  writeMigration(root, "001_initial_schema.sql");
  writeManifest(root);
  writeMigration(root, "001_initial_schema.sql", "create table if not exists public.changed (id uuid primary key);\n");

  const report = analyzeMigrationManifest({ root });
  const codes = report.issues.map((row) => row.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("stale_migration_manifest_hash"));
  assert.ok(codes.includes("migration_manifest_drift"));
});
