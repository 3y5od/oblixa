#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

export const LOCAL_READ_ONLY_COMMANDS = [
  "npm run check:migrations:strict",
  "npm run check:migration-manifest",
  "npm run check:migration-organization",
  "npm run check:migration-idempotency",
  "npm run check:supabase:ops",
  "npm run check:supabase:snapshot",
  "npm run check:supabase:fingerprint-artifact",
  "npm run check:supabase:local-reset-harness",
  "npm run check:supabase:seed-safety",
  "npm run check:supabase:retention-inventory",
  "npm run check:rls-sanity-tables",
  "npm run check:sql-definer-invoker-inventory",
  "npm run check:sql-security-migrations-bundle",
  "npm run check:runtime-health-probe-contracts",
];

export const LOCAL_EXPLICIT_EXECUTION_COMMANDS = [
  "npm run test:supabase:local-reset",
];

export const LOCAL_REPORT_COMMANDS = [
  "npm run report:supabase:fingerprint-drift",
  "npm run report:migration-rollbacks",
  "npm run report:supabase:release-checklist",
  "npm run report:production-evidence-summary",
  "npm run report:hardening-pr-summary",
];

export const OPTIONAL_LINKED_READ_ONLY_COMMANDS = [
  "npm run check:supabase:prod",
  "npm run check:supabase:prod:deep",
];

export const SMOKE_COMMANDS = [
  { service: "PostgREST", command: "npm run check:supabase:prod", credentialRequirement: "production", mutates: false },
  { service: "Auth", command: "npm run check:supabase:prod", credentialRequirement: "production", mutates: false },
  { service: "Storage", command: "npm run check:supabase:prod", credentialRequirement: "production", mutates: false },
  { service: "Critical app routes", command: "npm run check:runtime-health-probe-contracts", credentialRequirement: "none", mutates: false },
];

const MANUAL_ACTIONS = [
  "Apply reviewed migrations through the approved production deployment path; this checklist does not apply them.",
  "Run optional linked read-only checks with valid production credentials before claiming production schema state.",
  "Record any provider dashboard, traffic, or secret changes separately; this checklist performs none.",
];

function readPackageScripts(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return pkg.scripts ?? {};
}

function scriptName(command) {
  const match = /^npm run ([^ ]+)/u.exec(command);
  return match?.[1] ?? null;
}

function commandHasSecretShape(command) {
  return /\b(?:postgres(?:ql)?:\/\/|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.|sk_(?:live|test)_|whsec_|SUPABASE_DB_PASSWORD=|SERVICE_ROLE|PASSWORD=)\b/u.test(command);
}

export function buildSupabaseReleaseChecklist(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const localReadOnlyCommands = options.localReadOnlyCommands ?? LOCAL_READ_ONLY_COMMANDS;
  const localExplicitExecutionCommands = options.localExplicitExecutionCommands ?? LOCAL_EXPLICIT_EXECUTION_COMMANDS;
  const localReportCommands = options.localReportCommands ?? LOCAL_REPORT_COMMANDS;
  const optionalLinkedReadOnlyCommands = options.optionalLinkedReadOnlyCommands ?? OPTIONAL_LINKED_READ_ONLY_COMMANDS;
  const smokeCommands = options.smokeCommands ?? SMOKE_COMMANDS;
  return {
    schemaVersion: 1,
    ok: true,
    summary: "Deterministic Supabase release checklist. No command is executed by this report.",
    commandGroups: {
      localReadOnly: localReadOnlyCommands.map((command) => ({ command, mutates: false, credentialRequirement: "none" })),
      localExplicitExecution: localExplicitExecutionCommands.map((command) => ({
        command,
        mutates: true,
        credentialRequirement: "local",
        note: "Runs only against local disposable Supabase when explicitly invoked.",
      })),
      localReports: localReportCommands.map((command) => ({ command, mutates: false, credentialRequirement: "none" })),
      optionalLinkedReadOnly: optionalLinkedReadOnlyCommands.map((command) => ({ command, mutates: false, credentialRequirement: "production" })),
      smoke: smokeCommands,
    },
    verificationQueries: [
      "select version, name, executed_at from supabase_migrations.schema_migrations order by version desc limit 20;",
      "select schemaname, tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;",
      "select schemaname, tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname;",
      "select n.nspname as schema, p.proname as function_name, p.prosecdef as security_definer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname;",
    ],
    manualActions: MANUAL_ACTIONS,
  };
}

export function analyzeSupabaseReleaseChecklist(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const checklist = buildSupabaseReleaseChecklist({ ...options, root });
  const scripts = options.packageScripts ?? readPackageScripts(root);
  const issues = [];
  const allCommands = Object.values(checklist.commandGroups).flat().map((entry) => entry.command);

  for (const command of allCommands) {
    const script = scriptName(command);
    if (!script) {
      issues.push({ issue: "release_checklist_unknown_command_shape", command });
    } else if (typeof scripts[script] !== "string") {
      issues.push({ issue: "release_checklist_missing_package_script", command, script });
    }
    if (commandHasSecretShape(command)) {
      issues.push({ issue: "release_checklist_secret_shaped_command", command });
    }
  }

  for (const entry of checklist.commandGroups.optionalLinkedReadOnly) {
    if (entry.credentialRequirement !== "production" || entry.mutates !== false) {
      issues.push({ issue: "linked_release_command_not_read_only", command: entry.command });
    }
  }

  for (const entry of checklist.commandGroups.localReadOnly) {
    if (entry.credentialRequirement !== "none" || entry.mutates !== false) {
      issues.push({ issue: "local_release_command_not_read_only", command: entry.command });
    }
  }

  return {
    ...checklist,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, format: "json", report: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--markdown") {
      options.format = "markdown";
    } else if (arg === "--report") {
      options.report = true;
    }
  }
  return options;
}

function renderMarkdown(report) {
  const lines = ["# Supabase Release Checklist", "", report.summary, ""];
  for (const [group, commands] of Object.entries(report.commandGroups)) {
    lines.push(`## ${group}`, "");
    for (const entry of commands) {
      lines.push(`- ${entry.command} (${entry.credentialRequirement}, mutates=${entry.mutates})`);
    }
    lines.push("");
  }
  lines.push("## Manual Actions", "");
  for (const action of report.manualActions) lines.push(`- ${action}`);
  return lines.join("\n");
}

export function runSupabaseReleaseChecklist(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeSupabaseReleaseChecklist(options);
  console.log(options.format === "markdown" ? renderMarkdown(report) : JSON.stringify(report, null, 2));
  if (!report.ok && !options.report) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseReleaseChecklist();
}
