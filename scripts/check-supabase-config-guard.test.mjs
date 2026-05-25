import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeSupabaseConfigGuard } from "./check-supabase-config-guard.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "supabase-config-guard-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeBase(root) {
  write(root, ".gitignore", "supabase/.branches\nsupabase/.temp\n");
  write(
    root,
    "scripts/baseline-registry.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        baselines: [
          {
            path: "scripts/example-baseline.json",
            temporaryPaths: ["supabase/.branches/**", "supabase/.temp/**"],
          },
        ],
      },
      null,
      2,
    ),
  );
  write(
    root,
    "supabase/config.toml",
    `
      project_id = "local-project"
      [db.migrations]
      enabled = true
      schema_paths = []
      [db.seed]
      enabled = true
      sql_paths = ["./seed.sql"]
      [auth]
      site_url = "http://localhost:3000"
    `,
  );
  write(root, "supabase/seed.sql", "insert into public.organizations(name) values ('Example');\n");
  write(root, "supabase/tests/rls_smoke.sql", "select 1;\n");
}

test("analyzeSupabaseConfigGuard accepts local-only Supabase config", () => {
  const root = makeRoot();
  writeBase(root);

  const report = analyzeSupabaseConfigGuard({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.ok(report.inventory.files.some((row) => row.path === "supabase/config.toml"));
  assert.ok(report.inventory.files.some((row) => row.path === "supabase/tests/rls_smoke.sql"));
});

test("analyzeSupabaseConfigGuard rejects production-like values in Supabase files", () => {
  const root = makeRoot();
  writeBase(root);
  write(root, "supabase/config.toml", 'project_id = "local"\n[auth]\nsite_url = "https://abc123.supabase.co"\n');

  const report = analyzeSupabaseConfigGuard({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "supabase_config_contains_remote_supabase_url"));
});

test("analyzeSupabaseConfigGuard rejects test SQL in migration paths", () => {
  const root = makeRoot();
  writeBase(root);
  write(root, "supabase/migrations/001_smoke.sql", "-- default_deny_smoke should not be a migration\nselect 1;\n");

  const report = analyzeSupabaseConfigGuard({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "test_sql_appears_under_migrations"));
});

test("analyzeSupabaseConfigGuard rejects seed or migration config drift that applies test SQL", () => {
  const root = makeRoot();
  writeBase(root);
  write(
    root,
    "supabase/config.toml",
    `
      project_id = "local-project"
      [db.migrations]
      enabled = true
      schema_paths = ["./tests"]
      [db.seed]
      enabled = true
      sql_paths = ["./seed.sql", "./tests/rls_smoke.sql"]
    `,
  );

  const report = analyzeSupabaseConfigGuard({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "unexpected_supabase_seed_sql_paths"));
  assert.ok(report.issues.some((row) => row.issue === "unexpected_supabase_migration_schema_paths"));
});

test("analyzeSupabaseConfigGuard requires local state gitignore and baseline exclusions", () => {
  const root = makeRoot();
  writeBase(root);
  write(root, ".gitignore", "supabase/.temp\n");
  write(
    root,
    "scripts/baseline-registry.json",
    JSON.stringify({ schemaVersion: 1, baselines: [{ path: "scripts/example-baseline.json", temporaryPaths: ["supabase/.temp/**"] }] }),
  );

  const report = analyzeSupabaseConfigGuard({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "supabase_local_state_not_gitignored" && row.localPath === "supabase/.branches"));
  assert.ok(
    report.issues.some(
      (row) =>
        row.issue === "supabase_local_state_missing_from_baseline_temporary_paths" &&
        row.localPath === "supabase/.branches/**",
    ),
  );
});
