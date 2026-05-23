#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DEFAULT_SQL_FILES = [
  "supabase/tests/rls_sanity_smoke.sql",
  "supabase/tests/rls_default_deny_smoke.sql",
  "supabase/tests/view_invoker_smoke.sql",
];
const DATABASE_URL_ENV_KEYS = [
  "RLS_SMOKE_DATABASE_URL",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
];

function resolveDatabaseUrl(env = process.env) {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
}

function rlsSmokeStrict(env = process.env) {
  return env.RLS_SMOKE_STRICT === "1" || env.SECURITY_RELEASE_REQUIRED === "1";
}

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "redacted";
    if (parsed.username) parsed.username = "redacted";
    return parsed.toString();
  } catch {
    return "[redacted]";
  }
}

export function buildRlsSmokePlan(root = ROOT, env = process.env) {
  const databaseUrl = resolveDatabaseUrl(env);
  const sqlFiles = DEFAULT_SQL_FILES.map((rel) => ({
    rel,
    abs: path.join(root, rel),
    exists: fs.existsSync(path.join(root, rel)),
  }));
  const missingSqlFiles = sqlFiles.filter((file) => !file.exists).map((file) => file.rel);

  return {
    ok: Boolean(databaseUrl) ? missingSqlFiles.length === 0 : !rlsSmokeStrict(env),
    mode: databaseUrl ? "psql" : rlsSmokeStrict(env) ? "missing_required_database_url" : "skipped_no_database_url",
    strict: rlsSmokeStrict(env),
    databaseUrlEnvKey: databaseUrl?.key ?? null,
    databaseUrl: databaseUrl ? redactDatabaseUrl(databaseUrl.value) : null,
    rawDatabaseUrl: databaseUrl?.value ?? null,
    sqlFiles,
    missingSqlFiles,
  };
}

function runPsqlFile(databaseUrl, sqlFile) {
  return new Promise((resolve) => {
    const child = spawn(
      "psql",
      ["--no-psqlrc", "--set=ON_ERROR_STOP=1", databaseUrl, "--file", sqlFile.abs],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          PGOPTIONS: "-c statement_timeout=30000",
        },
        stdio: "inherit",
      }
    );
    child.on("error", (error) => {
      resolve({
        rel: sqlFile.rel,
        ok: false,
        code: 127,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    child.on("close", (code) => {
      resolve({
        rel: sqlFile.rel,
        ok: code === 0,
        code: code ?? 1,
      });
    });
  });
}

export async function runRlsSmoke(root = ROOT, env = process.env) {
  const plan = buildRlsSmokePlan(root, env);
  if (!plan.rawDatabaseUrl) {
    return {
      ok: !plan.strict,
      mode: plan.mode,
      strict: plan.strict,
      hint: `Set ${DATABASE_URL_ENV_KEYS.join(" or ")} to run ${DEFAULT_SQL_FILES.length} RLS smoke SQL file(s).`,
      sqlFiles: plan.sqlFiles.map(({ rel, exists }) => ({ rel, exists })),
    };
  }
  if (plan.missingSqlFiles.length > 0) {
    return {
      ok: false,
      mode: plan.mode,
      databaseUrlEnvKey: plan.databaseUrlEnvKey,
      missingSqlFiles: plan.missingSqlFiles,
      results: [],
    };
  }

  const results = [];
  for (const sqlFile of plan.sqlFiles) {
    results.push(await runPsqlFile(plan.rawDatabaseUrl, sqlFile));
    if (!results.at(-1)?.ok) break;
  }

  return {
    ok: results.every((result) => result.ok),
    mode: plan.mode,
    databaseUrlEnvKey: plan.databaseUrlEnvKey,
    databaseUrl: plan.databaseUrl,
    results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runRlsSmoke();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
