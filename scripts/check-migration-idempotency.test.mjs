import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeMigrationIdempotency,
  buildMigrationIdempotencyExceptions,
  scanMigrationIdempotency,
} from "./check-migration-idempotency.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "migration-idempotency-"));
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("scanMigrationIdempotency flags unguarded risky DDL and ignores guarded DDL", () => {
  const root = makeRoot();
  write(
    root,
    "supabase/migrations/001_initial_schema.sql",
    `
create table public.accounts (id uuid primary key);
create table if not exists public.organizations (id uuid primary key);
create index accounts_id_idx on public.accounts (id);
alter table public.accounts add column display_name text;
alter table public.accounts add column if not exists created_at timestamptz;
`,
  );

  const findings = scanMigrationIdempotency(root);
  assert.deepEqual(
    findings.map((finding) => finding.issue),
    ["unguarded_create_table", "unguarded_create_index", "unguarded_add_column"],
  );
});

test("analyzeMigrationIdempotency passes with reviewed exceptions", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial_schema.sql", "create table public.accounts (id uuid primary key);\n");
  writeJson(root, "scripts/migration-idempotency-exceptions.json", buildMigrationIdempotencyExceptions(root));

  const report = analyzeMigrationIdempotency({ root });
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.findingCount, 1);
});

test("analyzeMigrationIdempotency fails on new unreviewed findings and reports stale reductions as warnings", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial_schema.sql", "create table public.accounts (id uuid primary key);\n");
  const exceptions = buildMigrationIdempotencyExceptions(root);
  writeJson(root, "scripts/migration-idempotency-exceptions.json", exceptions);
  write(root, "supabase/migrations/001_initial_schema.sql", "create table if not exists public.accounts (id uuid primary key);\n");
  write(root, "supabase/migrations/002_more_schema.sql", "alter table public.accounts add column display_name text;\n");

  const report = analyzeMigrationIdempotency({ root });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "unreviewed_migration_idempotency_finding");
  assert.equal(report.warnings[0].issue, "stale_migration_idempotency_exception");
});
