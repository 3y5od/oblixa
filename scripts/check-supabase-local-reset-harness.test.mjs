import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildSupabaseLocalResetHarness,
  LOCAL_RESET_STEPS,
} from "./check-supabase-local-reset-harness.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "supabase-local-reset-harness-"));
}

function write(root, rel, content = "") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeFixture(root) {
  write(root, "supabase/config.toml", "[db.seed]\nsql_paths = [\"./seed.sql\"]\n");
  write(root, "supabase/seed.sql", "-- local seed\n");
  write(root, "supabase/tests/rls_sanity_smoke.sql", "-- smoke\n");
  write(root, "supabase/tests/rls_default_deny_smoke.sql", "-- default deny\n");
  const scripts = Object.fromEntries(
    LOCAL_RESET_STEPS.filter((step) => step.script).map((step) => [step.script, "node scripts/example.mjs"]),
  );
  write(root, "package.json", JSON.stringify({ scripts }, null, 2));
}

test("buildSupabaseLocalResetHarness emits dry-run commands and does not require production credentials", () => {
  const root = makeRoot();
  writeFixture(root);

  const report = buildSupabaseLocalResetHarness(root);

  assert.equal(report.ok, true);
  assert.equal(report.executeRequested, false);
  assert.equal(report.commands.some((step) => step.command === "supabase db reset --local"), true);
  assert.equal(report.commands.every((step) => step.requiresProductionCredentials === false), true);
  assert.equal(report.commands.filter((step) => step.mutatesLocalDatabase).length, 1);
});

test("buildSupabaseLocalResetHarness fails on missing reset prerequisites", () => {
  const root = makeRoot();
  write(root, "package.json", JSON.stringify({ scripts: {} }, null, 2));

  const report = buildSupabaseLocalResetHarness(root);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "missing_local_reset_required_file"));
  assert.ok(report.issues.some((issue) => issue.issue === "missing_local_reset_package_script"));
});
