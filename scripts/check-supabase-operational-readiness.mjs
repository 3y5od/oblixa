#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  analyzeSupabaseAdvisorRows,
  summarizeSupabaseAdvisorRows,
} from "./check-supabase-advisor-registry.mjs";

const DEFAULT_ROOT = process.cwd();
const require = createRequire(import.meta.url);

function loadProjectEnv(root) {
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(root);
  } catch {
    // Keep this script usable in minimal environments that only need local migration checks.
  }
}

export function readMigrationVersions(root = DEFAULT_ROOT) {
  const dir = path.join(root, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => statSync(path.join(dir, name)).isFile())
    .sort((a, b) => a.localeCompare(b));

  return files.map((file) => {
    const match = /^(\d+)_/.exec(file);
    return {
      file,
      version: match?.[1] ?? null,
      numericVersion: match ? Number(match[1]) : null,
    };
  });
}

export function analyzeLocalMigrationSequence(root = DEFAULT_ROOT) {
  const migrations = readMigrationVersions(root);
  const issues = [];
  const seen = new Map();

  for (const migration of migrations) {
    if (!migration.version || !/^\d{3}$/.test(migration.version)) {
      issues.push({ issue: "migration_filename_must_start_with_three_digit_prefix", file: migration.file });
      continue;
    }
    const bucket = seen.get(migration.version) ?? [];
    bucket.push(migration.file);
    seen.set(migration.version, bucket);
  }

  for (const [version, files] of seen) {
    if (files.length > 1) {
      issues.push({ issue: "duplicate_migration_version", version, files });
    }
  }

  const numeric = migrations
    .map((migration) => migration.numericVersion)
    .filter((version) => Number.isInteger(version))
    .sort((a, b) => a - b);

  if (numeric.length === 0) {
    issues.push({ issue: "no_migrations_found" });
  }

  for (let i = 0; i < numeric.length; i += 1) {
    const expected = i + 1;
    if (numeric[i] !== expected) {
      issues.push({ issue: "non_contiguous_migration_versions", expected, actual: numeric[i] });
      break;
    }
  }

  return {
    ok: issues.length === 0,
    migrationCount: migrations.length,
    firstVersion: migrations[0]?.version ?? null,
    lastVersion: migrations[migrations.length - 1]?.version ?? null,
    versions: migrations.map((migration) => migration.version).filter(Boolean),
    issues,
  };
}

export function buildCatalogFingerprintSql() {
  return `
with table_sigs as (
  select c.oid::regclass::text as name,
    c.relkind::text || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text as sig
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p')
),
column_sigs as (
  select c.table_name || '.' || c.column_name as name,
    concat_ws(':', c.data_type, c.udt_name, c.is_nullable, coalesce(c.column_default, '')) as sig
  from information_schema.columns c
  where c.table_schema = 'public'
),
constraint_sigs as (
  select conrelid::regclass::text || ':' || conname as name,
    contype::text || ':' || pg_get_constraintdef(oid) as sig
  from pg_constraint
  where connamespace = 'public'::regnamespace
),
index_sigs as (
  select indexname as name, indexdef as sig
  from pg_indexes
  where schemaname = 'public'
),
policy_sigs as (
  select schemaname || '.' || tablename || ':' || policyname as name,
    concat_ws(':', permissive, roles::text, cmd, coalesce(qual, ''), coalesce(with_check, '')) as sig
  from pg_policies
  where schemaname = 'public'
),
function_sigs as (
  select p.oid::regprocedure::text as name, md5(pg_get_functiondef(p.oid)) as sig
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
),
view_sigs as (
  select c.oid::regclass::text as name, md5(pg_get_viewdef(c.oid, true)) as sig
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('v', 'm')
),
trigger_sigs as (
  select t.tgrelid::regclass::text || ':' || t.tgname as name, md5(pg_get_triggerdef(t.oid, true)) as sig
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where c.relnamespace = 'public'::regnamespace
    and not t.tgisinternal
),
extension_sigs as (
  select extname as name, extversion as sig
  from pg_extension
  where extname in ('pgcrypto', 'pg_trgm')
)
select 'columns' as kind, count(*)::int as count, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) as fingerprint from column_sigs
union all select 'constraints', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from constraint_sigs
union all select 'extensions', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from extension_sigs
union all select 'functions', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from function_sigs
union all select 'indexes', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from index_sigs
union all select 'policies', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from policy_sigs
union all select 'tables', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from table_sigs
union all select 'triggers', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from trigger_sigs
union all select 'views', count(*)::int, md5(coalesce(string_agg(name || '=' || sig, ';' order by name), '')) from view_sigs
order by kind;`.replace(/\s+/g, " ").trim();
}

function defaultRunner(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? DEFAULT_ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function parseJsonPayload(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) return [];
  const objectIndex = text.indexOf("{");
  const arrayIndex = text.indexOf("[");
  const starts = [objectIndex, arrayIndex].filter((index) => index >= 0).sort((a, b) => a - b);
  if (starts.length === 0) throw new Error(`No JSON payload found in command output: ${text.slice(0, 160)}`);
  return JSON.parse(text.slice(starts[0]));
}

function runSupabaseJson(args, options) {
  const result = options.runner("supabase", args, { cwd: options.root, env: options.env });
  if ((result.status ?? 1) !== 0) {
    throw new Error([`supabase ${args.join(" ")} failed`, result.stderr, result.stdout].filter(Boolean).join("\n"));
  }
  return parseJsonPayload(result.stdout);
}

async function serviceSmoke(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const checks = [];
  const issues = [];

  if (!url || !key) {
    return {
      ok: false,
      checks,
      issues: [{ issue: "missing_supabase_public_env", required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] }],
    };
  }

  async function check(name, pathName, init = {}) {
    const started = Date.now();
    try {
      const response = await fetch(`${url}${pathName}`, {
        ...init,
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      const body = await response.text();
      const row = { name, status: response.status, elapsedMs: Date.now() - started, body: body.slice(0, 120) };
      checks.push(row);
      if (response.status >= 500) issues.push({ issue: "supabase_service_5xx", ...row });
    } catch (error) {
      issues.push({ issue: "supabase_service_fetch_failed", name, message: error?.message ?? String(error) });
    }
  }

  await check("rest", "/rest/v1/contracts?select=id&limit=1");
  await check("auth", "/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: "nobody@example.invalid", password: "definitely-wrong-password" }),
  });
  await check("storage", "/storage/v1/bucket");

  return { ok: issues.length === 0, checks, issues };
}

export async function runSupabaseOperationalReadiness({
  root = DEFAULT_ROOT,
  env = process.env,
  runner = defaultRunner,
  linked = false,
  compareLocal = false,
  smoke = false,
  warnSummary = false,
  advisors = true,
} = {}) {
  const issues = [];
  const localMigrations = analyzeLocalMigrationSequence(root);
  issues.push(...localMigrations.issues);

  const report = {
    ok: true,
    linked,
    localMigrations,
    remoteLedger: null,
    catalogFingerprints: null,
    advisorErrors: null,
    advisorWarnings: null,
    advisorWarningRegistry: null,
    serviceSmoke: null,
    issues,
  };

  const commandOptions = { root, env, runner };

  if (linked) {
    const ledger = runSupabaseJson(
      [
        "db",
        "query",
        "--linked",
        "select version from supabase_migrations.schema_migrations order by version;",
      ],
      commandOptions
    );
    const remoteVersions = (ledger.rows ?? []).map((row) => row.version);
    const localVersions = localMigrations.versions;
    const missingRemote = localVersions.filter((version) => !remoteVersions.includes(version));
    const extraRemote = remoteVersions.filter((version) => !localVersions.includes(version));
    report.remoteLedger = {
      migrationCount: remoteVersions.length,
      firstVersion: remoteVersions[0] ?? null,
      lastVersion: remoteVersions[remoteVersions.length - 1] ?? null,
      missingRemote,
      extraRemote,
    };
    if (missingRemote.length > 0 || extraRemote.length > 0) {
      issues.push({ issue: "remote_migration_ledger_mismatch", missingRemote, extraRemote });
    }

    if (compareLocal) {
      const sql = buildCatalogFingerprintSql();
      const local = runSupabaseJson(["db", "query", "--local", sql], commandOptions).rows ?? [];
      const remote = runSupabaseJson(["db", "query", "--linked", sql], commandOptions).rows ?? [];
      const remoteByKind = new Map(remote.map((row) => [row.kind, row]));
      const mismatches = [];
      for (const row of local) {
        const remoteRow = remoteByKind.get(row.kind);
        if (!remoteRow || remoteRow.count !== row.count || remoteRow.fingerprint !== row.fingerprint) {
          mismatches.push({ kind: row.kind, local: row, remote: remoteRow ?? null });
        }
      }
      report.catalogFingerprints = { local, remote, mismatches };
      if (mismatches.length > 0) issues.push({ issue: "catalog_fingerprint_mismatch", mismatches });
    }

    if (advisors) {
      const advisorRows = runSupabaseJson(
        ["db", "advisors", "--linked", "--type", "all", "--level", "error", "-o", "json"],
        commandOptions
      );
      report.advisorErrors = summarizeSupabaseAdvisorRows(advisorRows);
      if (report.advisorErrors.total > 0) issues.push({ issue: "supabase_advisor_errors", ...report.advisorErrors });
    }

    if (warnSummary) {
      const warningRows = runSupabaseJson(
        ["db", "advisors", "--linked", "--type", "all", "--level", "warn", "-o", "json"],
        commandOptions
      );
      report.advisorWarnings = summarizeSupabaseAdvisorRows(warningRows);
      report.advisorWarningRegistry = analyzeSupabaseAdvisorRows({ root, rows: warningRows });
      if (!report.advisorWarningRegistry.ok) {
        issues.push(...report.advisorWarningRegistry.issues);
      }
    }
  }

  if (smoke) {
    report.serviceSmoke = await serviceSmoke(env);
    issues.push(...report.serviceSmoke.issues);
  }

  report.ok = issues.length === 0;
  return report;
}

function hasArg(name) {
  return process.argv.includes(name);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadProjectEnv(DEFAULT_ROOT);
  const report = await runSupabaseOperationalReadiness({
    linked: hasArg("--linked"),
    compareLocal: hasArg("--compare-local"),
    smoke: hasArg("--smoke"),
    warnSummary: hasArg("--warn-summary"),
    advisors: !hasArg("--skip-advisors"),
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
