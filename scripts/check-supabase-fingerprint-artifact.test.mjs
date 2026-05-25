import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeSupabaseFingerprintArtifact,
  buildSupabaseFingerprintArtifact,
} from "./check-supabase-fingerprint-artifact.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "supabase-fingerprint-"));
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("buildSupabaseFingerprintArtifact splits catalog objects into stable sections", () => {
  const root = makeRoot();
  write(
    root,
    "supabase/migrations/001_initial.sql",
    `
create extension if not exists pgcrypto;
create table if not exists public.accounts (
  id uuid primary key,
  name text not null,
  constraint accounts_name_check check (length(name) > 0)
);
alter table public.accounts add column if not exists created_at timestamptz;
create index if not exists accounts_created_at_idx on public.accounts (created_at);
create policy "accounts select" on public.accounts for select using (true);
create or replace function public.account_count() returns int language sql as $$ select 1 $$;
create or replace view public.account_summary as select id from public.accounts;
create trigger accounts_touch before update on public.accounts for each row execute function public.account_count();
`,
  );

  const artifact = buildSupabaseFingerprintArtifact(root);
  assert.equal(artifact.migrationCount, 1);
  assert.equal(artifact.sections.tables.count, 1);
  assert.equal(artifact.sections.columns.count, 3);
  assert.equal(artifact.sections.constraints.count, 1);
  assert.equal(artifact.sections.indexes.count, 1);
  assert.equal(artifact.sections.policies.count, 1);
  assert.equal(artifact.sections.functions.count, 1);
  assert.equal(artifact.sections.views.count, 1);
  assert.equal(artifact.sections.triggers.count, 1);
  assert.equal(artifact.sections.extensions.count, 1);
});

test("analyzeSupabaseFingerprintArtifact passes when artifact is current", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial.sql", "create table if not exists public.accounts (id uuid primary key);\n");
  writeJson(root, "artifacts/supabase/local-catalog-fingerprint.json", buildSupabaseFingerprintArtifact(root));

  const report = analyzeSupabaseFingerprintArtifact({ root });
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.driftFindings, []);
});

test("analyzeSupabaseFingerprintArtifact reports category drift and remediation", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_initial.sql", "create table if not exists public.accounts (id uuid primary key);\n");
  const artifact = buildSupabaseFingerprintArtifact(root);
  writeJson(root, "artifacts/supabase/local-catalog-fingerprint.json", artifact);
  write(root, "supabase/migrations/002_add_orgs.sql", "create table if not exists public.organizations (id uuid primary key);\n");

  const report = analyzeSupabaseFingerprintArtifact({ root });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "fingerprint_artifact_drift");
  assert.equal(report.driftFindings[0].issue, "unexpected_object");
  assert.equal(report.driftFindings[0].section, "columns");
  assert.ok(report.remediationQueue[0].action.includes("refresh the fingerprint artifact"));
});
