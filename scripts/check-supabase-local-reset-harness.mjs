#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

export const LOCAL_RESET_STEPS = [
  { script: "check:supabase:config", purpose: "Validate local Supabase config before reset." },
  { command: "supabase db reset --local", purpose: "Recreate local database and apply all local migrations and seed SQL." },
  { script: "check:migrations:strict", purpose: "Verify migration naming and risky SQL patterns." },
  { script: "check:migration-manifest", purpose: "Verify migration manifest drift." },
  { script: "check:supabase:seed-safety", purpose: "Verify seed references, secret shape, and RLS coverage linkage." },
  { script: "check:sql-security-migrations-bundle", purpose: "Run RLS and SQL security bundle." },
  { script: "test:rls-smoke", purpose: "Run local RLS smoke SQL." },
];

const REQUIRED_FILES = [
  "supabase/config.toml",
  "supabase/seed.sql",
  "supabase/tests/rls_sanity_smoke.sql",
  "supabase/tests/rls_default_deny_smoke.sql",
  "package.json",
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function commandText(step) {
  return step.script ? `npm run ${step.script}` : step.command;
}

function executableExists(name) {
  const result = spawnSync("sh", ["-lc", `command -v ${name}`], {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  });
  return (result.status ?? 1) === 0;
}

function validateSteps(root, steps) {
  const issues = [];
  const pkgPath = path.join(root, "package.json");
  const scripts = fs.existsSync(pkgPath) ? readJson(pkgPath).scripts ?? {} : {};

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(root, file))) issues.push({ issue: "missing_local_reset_required_file", path: file });
  }

  for (const step of steps) {
    if (step.script && typeof scripts[step.script] !== "string") {
      issues.push({ issue: "missing_local_reset_package_script", script: step.script });
    }
  }

  if (!executableExists("supabase")) {
    issues.push({
      issue: "supabase_cli_not_found",
      command: "supabase db reset --local",
      severity: "warning",
      message: "Install Supabase CLI before running npm run test:supabase:local-reset.",
    });
  }

  return issues;
}

export function buildSupabaseLocalResetHarness(root = DEFAULT_ROOT, options = {}) {
  const steps = options.steps ?? LOCAL_RESET_STEPS;
  const issues = validateSteps(root, steps);
  const blockingIssues = issues.filter((issue) => issue.severity !== "warning");
  return {
    schemaVersion: 1,
    ok: blockingIssues.length === 0,
    summary: "Local Supabase reset harness is a dry-run by default and never targets linked production projects.",
    executeRequested: Boolean(options.execute),
    commandCount: steps.length,
    commands: steps.map((step, index) => ({
      order: index + 1,
      command: commandText(step),
      purpose: step.purpose,
      mutatesLocalDatabase: step.command === "supabase db reset --local",
      requiresProductionCredentials: false,
    })),
    issueCount: issues.length,
    issues,
    manualActions: [
      "Run npm run test:supabase:local-reset only against a disposable local Supabase instance.",
      "Run optional linked read-only checks separately before claiming production state.",
    ],
  };
}

function runShellCommand(root, command) {
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD ?? "",
    },
  });
  return { ok: (result.status ?? 1) === 0, code: result.status ?? 1, command };
}

export function executeSupabaseLocalResetHarness(root = DEFAULT_ROOT, steps = LOCAL_RESET_STEPS) {
  const results = [];
  for (const step of steps) {
    const result = runShellCommand(root, commandText(step));
    results.push(result);
    if (!result.ok) break;
  }
  return {
    ok: results.every((result) => result.ok),
    results,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, execute: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--execute") {
      options.execute = true;
    }
  }
  return options;
}

export function runSupabaseLocalResetHarness(options = parseArgs(process.argv.slice(2))) {
  const report = buildSupabaseLocalResetHarness(options.root, options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
    return report;
  }
  if (options.execute) {
    const execution = executeSupabaseLocalResetHarness(options.root);
    if (!execution.ok) process.exitCode = 1;
    return { ...report, execution };
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseLocalResetHarness();
}
