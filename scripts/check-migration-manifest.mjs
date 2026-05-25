#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_MANIFEST_REL = "artifacts/supabase/migration-manifest.json";
const MIGRATIONS_REL = "supabase/migrations";
const CHANGE_TYPES = new Set(["schema-only", "data-changing", "policy-changing", "cleanup-only"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);
const DOMAINS = new Set([
  "billing",
  "core_schema",
  "data_retention",
  "identity_and_access",
  "observability",
  "performance",
  "reporting",
  "runtime_contracts",
  "security",
  "storage",
  "workflow",
]);

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function readText(abs) {
  return fs.readFileSync(abs, "utf8");
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function migrationFileNameParts(file) {
  const match = /^(\d+)_([a-z0-9][a-z0-9-_]*)\.sql$/u.exec(file);
  if (!match) return null;
  return {
    version: match[1],
    slug: match[2],
  };
}

function titleFromSlug(slug) {
  return slug
    .split(/[-_]+/u)
    .filter(Boolean)
    .map((part) => part.toUpperCase() === part ? part : part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function listMigrationFiles(root = DEFAULT_ROOT) {
  const migrationsDir = path.join(root, MIGRATIONS_REL);
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function classifyDomain({ slug, sql }) {
  const haystack = `${slug}\n${sql}`.toLowerCase();
  if (/\b(stripe|billing|invoice|subscription|trial|webhook)\b/u.test(haystack)) return "billing";
  if (/\b(retention|cleanup|redact|revocation|transient)\b/u.test(haystack)) return "data_retention";
  if (/\b(rls|policy|policies|security|definer|invoker|grant|revoke|mfa|legal_hold)\b/u.test(haystack)) {
    return "security";
  }
  if (/\b(auth|user|profile|org_member|organization_invite|invite|member|role)\b/u.test(haystack)) {
    return "identity_and_access";
  }
  if (/\b(storage|bucket|object)\b/u.test(haystack)) return "storage";
  if (/\b(report|analytics|dashboard|metric|snapshot)\b/u.test(haystack)) return "reporting";
  if (/\b(index|performance|perf|lookup|dedupe|idempotency)\b/u.test(haystack)) return "performance";
  if (/\b(runtime|contract)\b/u.test(slug)) return "runtime_contracts";
  if (/\b(observability|worker|retry|dispatch)\b/u.test(haystack)) return "observability";
  if (/\b(task|workflow|obligation|approval|sla|renewal|intake|decision|external_action|campaign)\b/u.test(haystack)) {
    return "workflow";
  }
  return "core_schema";
}

function classifyChangeType({ slug, sql }) {
  const haystack = `${slug}\n${sql}`;
  if (
    /\b(create|alter|drop)\s+policy\b/iu.test(haystack) ||
    /\benable\s+row\s+level\s+security\b/iu.test(haystack) ||
    /\bforce\s+row\s+level\s+security\b/iu.test(haystack) ||
    /\bgrant\s+execute\b/iu.test(haystack) ||
    /\brevoke\s+(all|execute)\b/iu.test(haystack) ||
    /\bsecurity\s+(definer|invoker)\b/iu.test(haystack)
  ) {
    return "policy-changing";
  }

  if (/^\s*(insert|update|delete)\s+(into\s+)?public\./imu.test(sql)) return "data-changing";
  if (/\b(cleanup|retention|redact|revocation|transient)\b/iu.test(slug)) return "cleanup-only";
  return "schema-only";
}

function riskLevelFor({ changeType, sql }) {
  if (
    changeType === "data-changing" ||
    /\b(drop\s+table|drop\s+column|truncate\s+table|disable\s+row\s+level\s+security)\b/iu.test(sql)
  ) {
    return "high";
  }

  if (
    changeType === "policy-changing" ||
    changeType === "cleanup-only" ||
    /\b(create\s+trigger|create\s+function|alter\s+table|drop\s+function|revoke\b|grant\b)\b/iu.test(sql)
  ) {
    return "medium";
  }

  return "low";
}

function requiresFollowUp({ domain, changeType, riskLevel }) {
  return (
    riskLevel !== "low" ||
    changeType === "policy-changing" ||
    changeType === "data-changing" ||
    domain === "security" ||
    domain === "storage"
  );
}

function deployWindowSafeFor({ changeType, riskLevel, sql }) {
  if (riskLevel === "high") return false;
  if (changeType === "data-changing") return false;
  if (/\b(drop\s+table|drop\s+column|truncate\s+table|disable\s+row\s+level\s+security)\b/iu.test(sql)) return false;
  return true;
}

export function classifyMigration({ file, sql }) {
  const parts = migrationFileNameParts(file);
  if (!parts) {
    return {
      version: null,
      slug: null,
      domain: "core_schema",
      changeType: "schema-only",
      riskLevel: "high",
      deployWindowSafe: false,
      requiresFollowUpVerification: true,
      purpose: "Invalid migration filename.",
    };
  }

  const domain = classifyDomain({ slug: parts.slug, sql });
  const changeType = classifyChangeType({ slug: parts.slug, sql });
  const riskLevel = riskLevelFor({ changeType, sql });
  return {
    version: parts.version,
    slug: parts.slug,
    domain,
    changeType,
    riskLevel,
    deployWindowSafe: deployWindowSafeFor({ changeType, riskLevel, sql }),
    requiresFollowUpVerification: requiresFollowUp({ domain, changeType, riskLevel }),
    purpose: titleFromSlug(parts.slug),
  };
}

export function buildMigrationManifest(root = DEFAULT_ROOT) {
  const files = listMigrationFiles(root);
  const migrations = files.map((file) => {
    const abs = path.join(root, MIGRATIONS_REL, file);
    const sql = readText(abs);
    const classification = classifyMigration({ file, sql });
    return {
      version: classification.version,
      file,
      sha256: sha256Text(sql),
      slug: classification.slug,
      purpose: classification.purpose,
      domain: classification.domain,
      changeType: classification.changeType,
      riskLevel: classification.riskLevel,
      deployWindowSafe: classification.deployWindowSafe,
      requiresFollowUpVerification: classification.requiresFollowUpVerification,
    };
  });

  const versions = migrations.map((entry) => Number(entry.version)).filter((value) => Number.isFinite(value));
  const gaps = [];
  for (let index = 1; index < versions.length; index += 1) {
    const previous = versions[index - 1];
    const current = versions[index];
    if (current - previous > 1) {
      gaps.push({
        after: String(previous).padStart(3, "0"),
        before: String(current).padStart(3, "0"),
        missing: Array.from({ length: current - previous - 1 }, (_, offset) =>
          String(previous + offset + 1).padStart(3, "0"),
        ),
      });
    }
  }

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-migration-manifest.mjs --write",
    sourceDirectory: MIGRATIONS_REL,
    migrationCount: migrations.length,
    firstVersion: migrations[0]?.version ?? null,
    latestVersion: migrations.at(-1)?.version ?? null,
    gaps,
    migrations,
  };
}

function issue(code, fields = {}) {
  return { code, ...fields };
}

function validateManifestEntry(entry, index, filesByName, issues) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    issues.push(issue("invalid_manifest_entry", { index, message: "Migration manifest entry must be an object." }));
    return;
  }

  for (const field of ["version", "file", "sha256", "slug", "purpose", "domain", "changeType", "riskLevel"]) {
    if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
      issues.push(issue("missing_migration_manifest_field", { file: entry.file ?? null, field }));
    }
  }

  for (const field of ["deployWindowSafe", "requiresFollowUpVerification"]) {
    if (typeof entry[field] !== "boolean") {
      issues.push(issue("missing_migration_manifest_field", { file: entry.file ?? null, field }));
    }
  }

  if (typeof entry.file !== "string") return;
  const parts = migrationFileNameParts(entry.file);
  if (!parts) {
    issues.push(issue("invalid_migration_manifest_file", { file: entry.file }));
    return;
  }

  if (entry.version !== parts.version) {
    issues.push(issue("migration_manifest_version_mismatch", { file: entry.file, expected: parts.version, actual: entry.version }));
  }
  if (entry.slug !== parts.slug) {
    issues.push(issue("migration_manifest_slug_mismatch", { file: entry.file, expected: parts.slug, actual: entry.slug }));
  }
  if (!DOMAINS.has(entry.domain)) {
    issues.push(issue("invalid_migration_manifest_domain", { file: entry.file, domain: entry.domain }));
  }
  if (!CHANGE_TYPES.has(entry.changeType)) {
    issues.push(issue("invalid_migration_manifest_change_type", { file: entry.file, changeType: entry.changeType }));
  }
  if (!RISK_LEVELS.has(entry.riskLevel)) {
    issues.push(issue("invalid_migration_manifest_risk_level", { file: entry.file, riskLevel: entry.riskLevel }));
  }
  if (!/^[a-f0-9]{64}$/u.test(String(entry.sha256))) {
    issues.push(issue("invalid_migration_manifest_hash", { file: entry.file }));
  }

  const currentSql = filesByName.get(entry.file);
  if (currentSql == null) {
    issues.push(issue("stale_migration_manifest_entry", { file: entry.file }));
    return;
  }

  const currentHash = sha256Text(currentSql);
  if (currentHash !== entry.sha256) {
    issues.push(
      issue("stale_migration_manifest_hash", {
        file: entry.file,
        expected: entry.sha256,
        actual: currentHash,
      }),
    );
  }
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return Array.from(duplicates).sort();
}

export function analyzeMigrationManifest(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const manifestRel = toPosix(options.manifestRel ?? DEFAULT_MANIFEST_REL);
  const manifestPath = path.join(root, manifestRel);
  const migrationFiles = listMigrationFiles(root);
  const filesByName = new Map(
    migrationFiles.map((file) => [file, readText(path.join(root, MIGRATIONS_REL, file))]),
  );
  const currentManifest = buildMigrationManifest(root);
  const issues = [];
  let manifest = null;

  try {
    manifest = JSON.parse(readText(manifestPath));
  } catch (error) {
    return {
      ok: false,
      manifestPath: manifestRel,
      migrationCount: migrationFiles.length,
      latestVersion: currentManifest.latestVersion,
      issueCount: 1,
      issues: [issue("migration_manifest_unreadable", { path: manifestRel, message: error.message })],
      current: currentManifest,
    };
  }

  if (manifest?.schemaVersion !== 1) {
    issues.push(issue("invalid_migration_manifest_schema_version", { path: manifestRel }));
  }
  if (manifest?.sourceDirectory !== MIGRATIONS_REL) {
    issues.push(issue("invalid_migration_manifest_source_directory", { path: manifestRel, expected: MIGRATIONS_REL }));
  }

  const entries = Array.isArray(manifest?.migrations) ? manifest.migrations : [];
  if (!Array.isArray(manifest?.migrations)) {
    issues.push(issue("invalid_migration_manifest_entries", { path: manifestRel }));
  }

  for (const version of duplicateValues(entries.map((entry) => entry?.version).filter(Boolean))) {
    issues.push(issue("duplicate_migration_manifest_version", { version }));
  }
  for (const file of duplicateValues(entries.map((entry) => entry?.file).filter(Boolean))) {
    issues.push(issue("duplicate_migration_manifest_file", { file }));
  }

  for (let index = 0; index < entries.length; index += 1) {
    validateManifestEntry(entries[index], index, filesByName, issues);
  }

  const entryFiles = new Set(entries.map((entry) => entry?.file).filter(Boolean));
  for (const file of migrationFiles) {
    if (!entryFiles.has(file)) {
      issues.push(issue("missing_migration_manifest_entry", { file }));
    }
  }

  const expectedText = stableStringify(currentManifest);
  const actualText = stableStringify(manifest);
  if (expectedText !== actualText) {
    issues.push(issue("migration_manifest_drift", { path: manifestRel, hint: "Run npm run write:migration-manifest" }));
  }

  return {
    ok: issues.length === 0,
    manifestPath: manifestRel,
    migrationCount: migrationFiles.length,
    latestVersion: currentManifest.latestVersion,
    gaps: currentManifest.gaps,
    issueCount: issues.length,
    issues: issues.sort((a, b) => {
      const fileCompare = String(a.file ?? "").localeCompare(String(b.file ?? ""));
      if (fileCompare !== 0) return fileCompare;
      return a.code.localeCompare(b.code);
    }),
    current: currentManifest,
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    manifestRel: DEFAULT_MANIFEST_REL,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
      continue;
    }
    if (arg === "--manifest") {
      options.manifestRel = toPosix(argv[index + 1] ?? DEFAULT_MANIFEST_REL);
      index += 1;
      continue;
    }
    if (arg.startsWith("--manifest=")) {
      options.manifestRel = toPosix(arg.slice("--manifest=".length));
      continue;
    }
    if (arg === "--write") {
      options.write = true;
    }
  }

  return options;
}

export function runMigrationManifestCheck(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const manifest = buildMigrationManifest(options.root);
    const manifestPath = path.join(options.root, options.manifestRel);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, stableStringify(manifest));
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.manifestRel,
          migrationCount: manifest.migrationCount,
          latestVersion: manifest.latestVersion,
          gaps: manifest.gaps,
        },
        null,
        2,
      ),
    );
    return manifest;
  }

  const report = analyzeMigrationManifest(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrationManifestCheck();
}
