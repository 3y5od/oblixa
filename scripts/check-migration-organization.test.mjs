import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeMigrationOrganization,
  buildMigrationOrganizationIndex,
} from "./check-migration-organization.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "migration-organization-"));
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("buildMigrationOrganizationIndex groups migrations and extracts policy affected tables", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial_schema.sql", "create table if not exists public.accounts (id uuid primary key);\n");
  write(root, "supabase/migrations/002_security_policy.sql", 'create policy "accounts select" on public.accounts for select using (true);\n');

  const index = buildMigrationOrganizationIndex(root);
  assert.equal(index.migrationCount, 2);
  assert.ok(index.groups.some((group) => group.label === "RLS And Security"));
  assert.deepEqual(index.policyChangingMigrations[0].affectedTables, ["public.accounts"]);
});

test("buildMigrationOrganizationIndex classifies dynamic public-table RLS loops", () => {
  const root = makeRoot();
  write(
    root,
    "supabase/migrations/001_force_current_public_tables.sql",
    `do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
    execute format('alter table %I.%I force row level security', r.schema_name, r.table_name);
  end loop;
end $$;
`
  );

  const index = buildMigrationOrganizationIndex(root);

  assert.deepEqual(index.policyChangingMigrations[0].affectedTables, ["public.*"]);
});

test("analyzeMigrationOrganization passes when artifact is current", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial_schema.sql", "create table if not exists public.accounts (id uuid primary key);\n");
  writeJson(root, "artifacts/supabase/migration-domain-index.json", buildMigrationOrganizationIndex(root));

  const report = analyzeMigrationOrganization({ root });
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test("analyzeMigrationOrganization reports artifact drift and undescriptive slugs", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial_schema.sql", "create table if not exists public.accounts (id uuid primary key);\n");
  writeJson(root, "artifacts/supabase/migration-domain-index.json", buildMigrationOrganizationIndex(root));
  write(root, "supabase/migrations/002_fix.sql", "create table if not exists public.organizations (id uuid primary key);\n");

  const report = analyzeMigrationOrganization({ root });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "migration_organization_artifact_drift"));
  assert.ok(report.issues.some((issue) => issue.issue === "migration_slug_not_descriptive"));
});
