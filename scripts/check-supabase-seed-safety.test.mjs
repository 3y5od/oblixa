import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeSupabaseSeedSafety } from "./check-supabase-seed-safety.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "supabase-seed-safety-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeBase(root) {
  write(
    root,
    "supabase/migrations/001_schema.sql",
    `create table public.organizations (
	      id uuid primary key,
	      name text,
	      org_settings_json jsonb
    );
    create table public.organization_members (
      id uuid primary key,
      organization_id uuid not null,
      user_id uuid not null,
      role text
    );`,
  );
  write(
    root,
    "supabase/tests/rls_sanity_smoke.sql",
    `insert into public.organizations (id, name) values ('00000000-0000-4000-8000-000000000101', 'Smoke');
     insert into public.organization_members (organization_id, user_id, role) values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 'owner');`,
  );
  write(root, "supabase/tests/rls_default_deny_smoke.sql", "-- default deny\n");
}

test("analyzeSupabaseSeedSafety accepts seed SQL that references local objects and RLS smoke paths", () => {
  const root = makeRoot();
  writeBase(root);
  write(
    root,
    "supabase/seed.sql",
    `insert into storage.buckets (id, name, public, file_size_limit) values ('contracts', 'contracts', false, 1);
	     insert into public.organizations (id, name, org_settings_json) values ('00000000-0000-4000-8000-000000000101', 'Local', '{}'::jsonb);`,
  );

  const report = analyzeSupabaseSeedSafety(root);

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.insertCount, 2);
});

test("analyzeSupabaseSeedSafety rejects stale table and column references", () => {
  const root = makeRoot();
  writeBase(root);
  write(
    root,
    "supabase/seed.sql",
    `insert into public.organizations (id, missing_column) values ('00000000-0000-4000-8000-000000000101', 'x');
     insert into public.removed_table (id) values ('00000000-0000-4000-8000-000000000102');`,
  );

  const report = analyzeSupabaseSeedSafety(root);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "seed_references_missing_column"));
  assert.ok(report.issues.some((issue) => issue.issue === "seed_references_missing_table"));
});

test("analyzeSupabaseSeedSafety rejects production-looking secret material", () => {
  const root = makeRoot();
  writeBase(root);
  write(
    root,
    "supabase/seed.sql",
    `insert into public.organizations (id, name) values ('00000000-0000-4000-8000-000000000101', 'sk_live_123456789012345678901234');`, // security:test-fixture-secret-placeholder
  );

  const report = analyzeSupabaseSeedSafety(root);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "seed_stripe_live_key"));
});

test("analyzeSupabaseSeedSafety links organization seed coverage to RLS smoke setup", () => {
  const root = makeRoot();
  writeBase(root);
  write(root, "supabase/tests/rls_sanity_smoke.sql", "-- no tenant setup\n");
  write(root, "supabase/seed.sql", `insert into public.organizations (id, name) values ('00000000-0000-4000-8000-000000000101', 'Local');`);

  const report = analyzeSupabaseSeedSafety(root);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "seed_rls_paths_missing_smoke_coverage"));
});
