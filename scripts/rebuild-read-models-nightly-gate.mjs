#!/usr/bin/env node
/**
 * When V10 migration disposable DB env is set, run read-model rebuild in dry-run against that stack.
 * Plan: optional nightly rebuild:read-models when V10_MIGRATION_SMOKE_* set.
 */
import { spawnSync } from "node:child_process";

const db = process.env.V10_MIGRATION_SMOKE_DATABASE_URL?.trim();
const allow = process.env.V10_MIGRATION_SMOKE_ALLOW_MUTATING_DATABASE === "1";
if (!db || !allow) {
  console.log(JSON.stringify({ ok: true, mode: "skipped_no_v10_migration_env" }, null, 2));
  process.exit(0);
}

process.env.V10_REBUILD_READ_MODEL_URL ??= process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
const r = spawnSync("npm", ["run", "rebuild:read-models", "--", "--dry-run", "--scope=repair", "--limit=5"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});
process.exit(r.status ?? 1);
