import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildRlsSmokePlan, runRlsSmoke } from "./rls-smoke.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeSqlFiles(root) {
  write(root, "supabase/tests/rls_sanity_smoke.sql", "select 1 as same_org_allowed;\n");
  write(root, "supabase/tests/rls_default_deny_smoke.sql", "select 1 as anon_direct_insert_denied;\n");
  write(root, "supabase/tests/view_invoker_smoke.sql", "select 1 as security_invoker;\n");
}

test("buildRlsSmokePlan skips safely when no database URL is configured", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-smoke-skip-"));
  writeSqlFiles(root);
  const env = {};
  const plan = buildRlsSmokePlan(root, env);
  assert.equal(plan.ok, true);
  assert.equal(plan.mode, "skipped_no_database_url");

  const report = await runRlsSmoke(root, env);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "skipped_no_database_url");
});

test("runRlsSmoke fails closed in strict mode when no database URL is configured", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-smoke-strict-"));
  writeSqlFiles(root);
  const env = { RLS_SMOKE_STRICT: "1" };
  const plan = buildRlsSmokePlan(root, env);
  assert.equal(plan.ok, false);
  assert.equal(plan.mode, "missing_required_database_url");
  assert.equal(plan.strict, true);

  const report = await runRlsSmoke(root, env);
  assert.equal(report.ok, false);
  assert.equal(report.mode, "missing_required_database_url");
});

test("buildRlsSmokePlan requires smoke SQL files when a database URL is configured", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-smoke-missing-"));
  const plan = buildRlsSmokePlan(root, {
    RLS_SMOKE_DATABASE_URL: "postgres://user:secret@example.test:5432/db",
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.mode, "psql");
  assert.equal(plan.databaseUrlEnvKey, "RLS_SMOKE_DATABASE_URL");
  assert.equal(plan.missingSqlFiles.length, 3);
  assert(plan.databaseUrl?.includes("redacted"));
  assert(!plan.databaseUrl?.includes("secret"));
});
