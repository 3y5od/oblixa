#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";

export const SQL_SECURITY_MIGRATIONS_BUNDLE_STEPS = [
  "check:migrations:strict",
  "check:rls-sanity-tables",
  "check:rls-policy-drift",
  "check:supabase:seed-safety",
  "check:supabase:retention-inventory",
  "check:migration-security-patterns:strict-inner",
  "check:sql-definer-invoker-inventory",
  "test:rls-smoke",
];

export async function runSqlSecurityMigrationsBundle() {
  const results = await runSequential(SQL_SECURITY_MIGRATIONS_BUNDLE_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return { pipeline: "sql-security-migrations-bundle", results, exitCode: failed ? failed.code : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runSqlSecurityMigrationsBundle();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}
