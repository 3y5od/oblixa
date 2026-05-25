#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildMigrationManifest } from "./check-migration-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/migration-domain-index.json";
const MIGRATIONS_REL = "supabase/migrations";
const LARGE_MIGRATION_LINE_THRESHOLD = 350;
const LARGE_MIGRATION_BYTE_THRESHOLD = 28_000;

const DOMAIN_LABELS = {
  billing: "Billing",
  core_schema: "Core Schema",
  data_retention: "Operational Cleanup",
  identity_and_access: "Auth And Identity",
  observability: "Jobs And Cron",
  performance: "Jobs And Cron",
  reporting: "Evidence",
  runtime_contracts: "Evidence",
  security: "RLS And Security",
  storage: "Storage",
  workflow: "Workflows",
};

function toPosix(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readSql(root, file) {
  return fs.readFileSync(path.join(root, MIGRATIONS_REL, file), "utf8");
}

function descriptiveSlugOk(slug) {
  const parts = String(slug ?? "").split(/[-_]+/u).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.length >= 3 && /^(?:fix|patch|update)$/iu.test(parts[0])) return true;
  return !parts.some((part) => /^(?:misc|change|tmp|wip)$/iu.test(part));
}

function extractAffectedTables(sql) {
  const tables = new Set();
  for (const pattern of [
    /\bcreate\s+policy\s+"?[^"\n]+?"?\s+on\s+"?(public|storage)"?\."?([a-z0-9_]+)"?/giu,
    /\balter\s+table\s+(?:only\s+)?"?public"?\."?([a-z0-9_]+)"?\s+(?:enable|force)\s+row\s+level\s+security\b/giu,
    /\b(?:grant|revoke)\s+[^;]*?\s+on\s+(?:table\s+)?"?public"?\."?([a-z0-9_]+)"?/giu,
  ]) {
    for (const match of sql.matchAll(pattern)) {
      if (match.length >= 3 && match[1] && match[2]) tables.add(`${match[1]}.${match[2]}`);
      else tables.add(`public.${match[1]}`);
    }
  }
  if (/\bfor\s+\w+\s+in\s+[\s\S]*?\bfrom\s+pg_class\b[\s\S]*?\bcreate\s+policy\b/iu.test(sql)) {
    tables.add("public.*");
  }
  return Array.from(tables).sort((a, b) => a.localeCompare(b));
}

function requiresAffectedTables(sql) {
  return (
    /\bcreate\s+policy\b|\balter\s+policy\b|\bdrop\s+policy\b/iu.test(sql) ||
    /\balter\s+table\s+[\s\S]*?\b(?:enable|force)\s+row\s+level\s+security\b/iu.test(sql) ||
    /\b(?:grant|revoke)\s+[^;]*?\s+on\s+(?:table\s+)?"?public"?\."?[a-z0-9_]+"?/iu.test(sql)
  );
}

function hasCleanupMarker(entry, sql) {
  return (
    entry.changeType === "cleanup-only" ||
    entry.domain === "data_retention" ||
    /\b(?:retention|cleanup|transient|redact|revocation)\b/iu.test(`${entry.slug}\n${sql}`)
  );
}

function verificationQueriesFor(entry, affectedTables) {
  const queries = [];
  if (entry.changeType === "policy-changing") {
    for (const table of affectedTables) {
      const [schemaName, tableName] = table.split(".");
      if (table === "public.*") {
        queries.push("select schemaname, tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname;");
      } else {
        queries.push(`select schemaname, tablename, policyname from pg_policies where schemaname = '${schemaName}' and tablename = '${tableName}' order by policyname;`);
      }
    }
  }
  if (entry.domain === "data_retention") {
    queries.push("select schemaname, tablename, indexname from pg_indexes where schemaname = 'public' and indexname ilike '%retention%' order by tablename, indexname;");
  }
  if (entry.riskLevel === "high") {
    queries.push("select version, name, executed_at from supabase_migrations.schema_migrations order by version desc limit 10;");
  }
  return queries;
}

function summarizeMigration(root, entry) {
  const sql = readSql(root, entry.file);
  const lineCount = sql.split(/\r?\n/u).length;
  const byteCount = Buffer.byteLength(sql, "utf8");
  const affectedTables = extractAffectedTables(sql);
  return {
    version: entry.version,
    file: entry.file,
    domain: entry.domain,
    domainLabel: DOMAIN_LABELS[entry.domain] ?? entry.domain,
    changeType: entry.changeType,
    riskLevel: entry.riskLevel,
    deployWindowSafe: entry.deployWindowSafe,
    requiresFollowUpVerification: entry.requiresFollowUpVerification,
    cleanupMarked: hasCleanupMarker(entry, sql),
    requiresAffectedTables: requiresAffectedTables(sql),
    affectedTables,
    lineCount,
    byteCount,
    large: lineCount >= LARGE_MIGRATION_LINE_THRESHOLD || byteCount >= LARGE_MIGRATION_BYTE_THRESHOLD,
    descriptiveSlug: descriptiveSlugOk(entry.slug),
    verificationQueries: verificationQueriesFor(entry, affectedTables),
  };
}

export function buildMigrationOrganizationIndex(root = DEFAULT_ROOT) {
  const manifest = buildMigrationManifest(root);
  const migrations = manifest.migrations.map((entry) => summarizeMigration(root, entry));
  const groups = Object.entries(
    migrations.reduce((acc, entry) => {
      const label = entry.domainLabel;
      acc[label] ??= [];
      acc[label].push(entry.file);
      return acc;
    }, {}),
  )
    .map(([label, files]) => ({ label, files: files.sort((a, b) => a.localeCompare(b)), count: files.length }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-migration-organization.mjs --write",
    sourceManifest: "artifacts/supabase/migration-manifest.json",
    sourceDirectory: MIGRATIONS_REL,
    migrationCount: migrations.length,
    latestVersion: manifest.latestVersion,
    groups,
    largeMigrations: migrations.filter((entry) => entry.large).map(({ file, lineCount, byteCount }) => ({ file, lineCount, byteCount })),
    highRiskMigrations: migrations.filter((entry) => entry.riskLevel === "high").map(({ file, changeType, domain, affectedTables }) => ({ file, changeType, domain, affectedTables })),
    policyChangingMigrations: migrations.filter((entry) => entry.changeType === "policy-changing").map(({ file, affectedTables, verificationQueries }) => ({ file, affectedTables, verificationQueries })),
    cleanupMigrations: migrations.filter((entry) => entry.cleanupMarked).map(({ file, domain, changeType }) => ({ file, domain, changeType })),
    migrations,
  };
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

export function analyzeMigrationOrganization(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = toPosix(options.artifactRel ?? DEFAULT_ARTIFACT_REL);
  const current = buildMigrationOrganizationIndex(root);
  const issues = [];
  let committed = null;

  try {
    committed = JSON.parse(fs.readFileSync(path.join(root, artifactRel), "utf8"));
  } catch (error) {
    return {
      ok: false,
      artifactPath: artifactRel,
      issueCount: 1,
      issues: [issue("migration_organization_artifact_unreadable", { path: artifactRel, message: error.message })],
      current,
    };
  }

  if (stableStringify(committed) !== stableStringify(current)) {
    issues.push(issue("migration_organization_artifact_drift", { path: artifactRel, hint: "Run npm run write:migration-organization" }));
  }

  for (const entry of current.migrations) {
    if (!entry.descriptiveSlug) issues.push(issue("migration_slug_not_descriptive", { path: `${MIGRATIONS_REL}/${entry.file}` }));
    if (entry.cleanupMarked && entry.domain !== "data_retention" && entry.changeType !== "cleanup-only") {
      issues.push(issue("cleanup_migration_not_marked", { path: `${MIGRATIONS_REL}/${entry.file}`, domain: entry.domain, changeType: entry.changeType }));
    }
    if (entry.changeType === "policy-changing" && entry.requiresAffectedTables && entry.affectedTables.length === 0) {
      issues.push(issue("policy_changing_migration_missing_affected_tables", { path: `${MIGRATIONS_REL}/${entry.file}` }));
    }
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    migrationCount: current.migrationCount,
    latestVersion: current.latestVersion,
    groupCount: current.groups.length,
    largeMigrationCount: current.largeMigrations.length,
    highRiskMigrationCount: current.highRiskMigrations.length,
    issueCount: issues.length,
    issues: issues.sort((a, b) => String(a.path ?? "").localeCompare(String(b.path ?? "")) || a.issue.localeCompare(b.issue)),
    current,
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
      options.artifactRel = toPosix(argv[index + 1] ?? DEFAULT_ARTIFACT_REL);
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = toPosix(arg.slice("--artifact=".length));
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runMigrationOrganizationCheck(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const index = buildMigrationOrganizationIndex(options.root);
    const artifactPath = path.join(options.root, options.artifactRel);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, stableStringify(index));
    console.log(JSON.stringify({ ok: true, wrote: options.artifactRel, migrationCount: index.migrationCount, latestVersion: index.latestVersion }, null, 2));
    return index;
  }

  const report = analyzeMigrationOrganization(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrationOrganizationCheck();
}
