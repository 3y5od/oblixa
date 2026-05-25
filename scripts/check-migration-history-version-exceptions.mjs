#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/migration-history-version-exceptions.json";
const MIGRATION_DIR_REL = "supabase/migrations";
const VERSION_TOKEN_RE = /(?:^|[^A-Za-z0-9])v[0-9]+(?=$|[^A-Za-z0-9])/giu;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function versionTokens(value) {
  return Array.from(new Set(Array.from(String(value).matchAll(VERSION_TOKEN_RE), (match) => match[0].replace(/^[^A-Za-z0-9]/u, "")))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function buildMigrationHistoryVersionExceptions(root = DEFAULT_ROOT, options = {}) {
  const migrationDirRel = options.migrationDirRel ?? MIGRATION_DIR_REL;
  const migrationDir = path.join(root, migrationDirRel);
  const issues = [];
  if (!fs.existsSync(migrationDir)) {
    issues.push({ issue: "migration_history_exception_missing_migration_dir", path: migrationDirRel });
  }
  const exceptions = fs.existsSync(migrationDir)
    ? fs
        .readdirSync(migrationDir)
        .filter((name) => name.endsWith(".sql") && versionTokens(name).length > 0)
        .map((name) => {
          const rel = `${migrationDirRel}/${name}`;
          return {
            path: rel,
            migrationFile: name,
            tokens: versionTokens(name),
            owner: "database-platform",
            classification: "immutable_migration_ledger_evidence",
            reason: "Historical Supabase migration filenames are deployed ledger evidence and must not be renamed by a code-only pass.",
            removalStrategy: "retain_as_historical_exception",
            validationCommand: "npm run check:migration-manifest",
            manualFollowUp: "Only revisit migration filename history during an explicit migration-ledger reconciliation or squash project.",
          };
        })
        .sort((a, b) => a.path.localeCompare(b.path))
    : [];

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-migration-history-version-exceptions.mjs --write",
    migrationDir: migrationDirRel,
    exceptionCount: exceptions.length,
    exceptions,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeMigrationHistoryVersionExceptions(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildMigrationHistoryVersionExceptions(root, options);
  const issues = [...current.issues];
  for (const [index, row] of current.exceptions.entries()) {
    for (const key of ["path", "owner", "classification", "reason", "removalStrategy", "validationCommand", "manualFollowUp"]) {
      if (typeof row[key] !== "string" || row[key].trim() === "") {
        issues.push({ issue: "migration_history_exception_missing_metadata", index, key, path: row.path ?? null });
      }
    }
  }
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push({ issue: "migration_history_exception_artifact_missing", path: artifactRel });
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push({ issue: "migration_history_exception_artifact_drift", path: artifactRel, hint: "Run npm run write:migration-history-version-exceptions" });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    exceptionCount: current.exceptionCount,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? DEFAULT_ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runMigrationHistoryVersionExceptions(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildMigrationHistoryVersionExceptions(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(JSON.stringify({ ok: artifact.issueCount === 0, wrote: options.artifactRel, exceptionCount: artifact.exceptionCount, issueCount: artifact.issueCount }, null, 2));
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeMigrationHistoryVersionExceptions(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrationHistoryVersionExceptions();
}
