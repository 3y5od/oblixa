#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildMigrationOrganizationIndex } from "./check-migration-organization.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

function rollbackNoteFor(entry) {
  if (entry.riskLevel === "high") {
    return "High-risk migration: prepare a reviewed forward-fix migration and data validation query before production apply.";
  }
  if (entry.changeType === "policy-changing") {
    return "Policy-changing migration: prepare a forward migration that restores previous grants/policies if access regressions are found.";
  }
  if (entry.cleanupMarked) {
    return "Cleanup migration: verify retention route idempotency and ensure cleanup deletes only expired transient rows.";
  }
  return "Schema-only migration: rollback should be a reviewed forward migration, not an in-place production edit.";
}

function readinessFor(entry) {
  return {
    file: entry.file,
    riskLevel: entry.riskLevel,
    changeType: entry.changeType,
    affectedTables: entry.affectedTables,
    rollbackNote: rollbackNoteFor(entry),
    verificationQueries: entry.verificationQueries.length
      ? entry.verificationQueries
      : ["select version, name, executed_at from supabase_migrations.schema_migrations order by version desc limit 10;"],
    manualActions: [
      "Do not run rollback SQL automatically.",
      "Use a reviewed forward migration for production correction.",
      "Capture linked read-only evidence before and after any production migration apply.",
    ],
  };
}

export function buildMigrationRollbackReport(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const maxEntries = Number.isInteger(options.maxEntries) ? options.maxEntries : 30;
  const index = options.index ?? buildMigrationOrganizationIndex(root);
  const entries = index.migrations.filter(
    (entry) => entry.riskLevel === "high" || entry.changeType === "policy-changing" || entry.cleanupMarked || entry.requiresFollowUpVerification,
  );
  const visibleEntries = maxEntries > 0 ? entries.slice(0, maxEntries) : entries;
  return {
    schemaVersion: 1,
    ok: true,
    summary: "Rollback-readiness report generated from local migrations only. No SQL is executed.",
    migrationCount: index.migrationCount,
    reviewedMigrationCount: entries.length,
    omittedEntryCount: Math.max(0, entries.length - visibleEntries.length),
    latestVersion: index.latestVersion,
    entries: visibleEntries.map(readinessFor),
    commands: [
      "npm run check:migration-organization",
      "npm run check:migration-idempotency",
      "npm run report:migration-rollbacks",
      "npm run check:supabase:prod:deep",
    ],
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, maxEntries: 30 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--max-entries") {
      options.maxEntries = Number.parseInt(argv[index + 1] ?? "30", 10);
      index += 1;
    } else if (arg.startsWith("--max-entries=")) {
      options.maxEntries = Number.parseInt(arg.slice("--max-entries=".length), 10);
    } else if (arg === "--all") {
      options.maxEntries = 0;
    }
  }
  return options;
}

export function runMigrationRollbackReport(options = parseArgs(process.argv.slice(2))) {
  const report = buildMigrationRollbackReport(options);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrationRollbackReport();
}
