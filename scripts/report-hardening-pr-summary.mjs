#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeChangeImpact, parseGitNameStatus } from "./check-ci-change-impact.mjs";
import { runVersionedNamingCheck } from "./check-versioned-naming.mjs";
import {
  DEFAULT_LINKED_READ_ONLY_COMMANDS,
  DEFAULT_LOCAL_COMMANDS,
  DEFAULT_MANUAL_ACTIONS,
} from "./report-production-evidence-summary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_BASE_REF = process.env.CI_CHANGE_IMPACT_BASE_REF?.trim() || "HEAD~1";

function toPosix(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function sortedUnique(values) {
  return Array.from(new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function isMigrationPath(file) {
  return /^supabase\/migrations\/.+\.sql$/u.test(file);
}

function listLocalMigrations(root) {
  const dir = path.join(root, "supabase", "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `supabase/migrations/${name}`);
}

function runGitNameStatus(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return (result.status ?? 1) === 0 ? parseGitNameStatus(result.stdout) : [];
}

function runGitLines(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if ((result.status ?? 1) !== 0) return [];
  return result.stdout
    .split(/\r?\n/u)
    .map((line) => toPosix(line.trim()))
    .filter(Boolean);
}

function collectSummaryChangedEntries({ root, baseRef }) {
  const committed = runGitNameStatus(root, ["diff", "--name-status", "--find-renames", `${baseRef}...HEAD`]);
  const unstaged = runGitNameStatus(root, ["diff", "--name-status", "--find-renames"]);
  const staged = runGitNameStatus(root, ["diff", "--cached", "--name-status", "--find-renames"]);
  const untracked = runGitLines(root, ["ls-files", "--others", "--exclude-standard"]).map((file) => ({
    status: "A",
    path: file,
    oldPath: null,
  }));
  const byKey = new Map();
  for (const entry of [...committed, ...unstaged, ...staged, ...untracked]) {
    byKey.set(`${entry.status}:${entry.oldPath ?? ""}:${entry.path}`, entry);
  }
  return Array.from(byKey.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function summarizeSupabase({ root, changeImpact, localCommandsRun }) {
  const changed = changeImpact.changed ?? [];
  const migrationChanges = changed.filter((entry) => isMigrationPath(entry.path) || isMigrationPath(entry.oldPath ?? ""));
  const changedSql = changed.filter((entry) => /^supabase\/(?:sql|tests)\/.+\.sql$/u.test(entry.path));
  const deletedMigrations = sortedUnique(migrationChanges.filter((entry) => entry.status === "D").map((entry) => entry.path));
  const addedMigrations = sortedUnique(migrationChanges.filter((entry) => entry.status === "A").map((entry) => entry.path));
  const renamedMigrations = migrationChanges
    .filter((entry) => entry.status === "R")
    .map((entry) => ({ from: entry.oldPath, to: entry.path }));
  const localMigrations = listLocalMigrations(root);

  return {
    affectsSupabase: migrationChanges.length > 0 || changedSql.length > 0 || Boolean(changeImpact.supabaseAffecting),
    latestLocalMigration: localMigrations.at(-1) ?? null,
    localMigrationCount: localMigrations.length,
    migrationChangeCount: migrationChanges.length,
    strictCheckStatus: localCommandsRun.includes("npm run check:migrations:strict") ? "reported_run" : "not_reported",
    addedMigrations,
    deletedMigrations,
    renamedMigrations,
    changedSqlFiles: sortedUnique(changedSql.map((entry) => entry.path)),
      requiredChecks: sortedUnique(
      (changeImpact.requiredChecks ?? []).filter((check) =>
        /migration|supabase|sql|rls|telemetry-event-inventory|compatibility-route-inventory|runtime-health-probe-contracts/u.test(check),
      ),
    ),
  };
}

function summarizeCompatibility(changeImpact) {
  const changed = changeImpact.changed ?? [];
  const sensitiveAreas = (changeImpact.riskAreas ?? [])
    .filter((area) =>
      ["api_routes", "cron_routes", "billing_webhooks", "rls_sql_functions", "migrations", "telemetry_events"].includes(area.area),
    )
    .map((area) => area.area);
  return {
    sensitiveAreas,
    renameFindings: changed
      .filter((entry) => entry.status === "R")
      .filter((entry) => {
        const areas = new Set(entry.riskAreas ?? []);
        return ["api_routes", "cron_routes", "billing_webhooks", "rls_sql_functions", "migrations", "telemetry_events"].some((area) =>
          areas.has(area),
        );
      })
      .map((entry) => ({ from: entry.oldPath, to: entry.path, riskAreas: entry.riskAreas ?? [] })),
    requiredChecks: sortedUnique(
      (changeImpact.requiredChecks ?? []).filter((check) =>
        /compatibility|versioned-exported-symbol-aliases|versioned-content-contracts|versioned-local-content-rewrites|versioned-content-surface-coverage|versioned-remaining-surface-coverage|versioned-detailed-objective-coverage|versioned-public-contract-preservation|versioned-public-runtime-dual-read|versioned-forward-migration-readiness|versioned-source-config-preservation|versioned-export-download-contracts|versioned-package-script-readiness|neutral-naming-rules|versioned-manual-surface-closure|versioned-open-objective-closure|versioned-compatibility-equivalence|versioned-local-surface-regression|versioned-alias-usage-neutrality|versioned-env-flag-aliases|versioned-code-only-closure|versioned-additive-alias-preservation|versioned-remaining-local-contract-closure|versioned-unchecked-objective-readiness|versioned-final-checklist-reconciliation|telemetry-event-inventory|sql-object-reference|sql-object-rename|sql-neutral-table-view-aliases|sql-policy-alias-readiness|sql-policy-predicate-equivalence|sql-policy-forward-migration-blueprint|sql-rename-verification-sql|sql-security-automation-coverage|migration-history-version-exceptions|seed-versioned-name-queue-coverage|api-route-auth-route-index|cron|webhook/u.test(check),
      ),
    ),
  };
}

function summarizeVersionedNaming(versionedNaming) {
  return {
    ok: Boolean(versionedNaming.ok),
    delta: Number(versionedNaming.delta ?? 0),
    currentTotal: Number(versionedNaming.currentTotal ?? 0),
    baselineTotal: Number(versionedNaming.baselineTotal ?? 0),
    violationCount: Number(versionedNaming.violationCount ?? 0),
    reductionCount: Number(versionedNaming.reductionCount ?? 0),
    violations: versionedNaming.violations ?? [],
    reductions: versionedNaming.reductions ?? [],
  };
}

function renderList(values, empty = "None") {
  const rows = sortedUnique(values);
  return rows.length ? rows.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

export function renderHardeningPrSummaryMarkdown(report) {
  return [
    "## Supabase And Naming Change Summary",
    "",
    `Production mutation performed: ${report.evidence.productionMutationPerformed ? "Yes" : "No"}`,
    `Linked production verification: ${report.evidence.linkedVerified ? "Run" : "Not run"}`,
    "",
    "### Supabase",
    "",
    `- Affects Supabase: ${report.supabase.affectsSupabase ? "Yes" : "No"}`,
    `- Latest local migration: ${report.supabase.latestLocalMigration ?? "None"}`,
    `- Local migration count: ${report.supabase.localMigrationCount}`,
    `- Migration changes: ${report.supabase.migrationChangeCount}`,
    `- Deleted migrations: ${report.supabase.deletedMigrations.length}`,
    `- Migration strict check: ${report.supabase.strictCheckStatus === "reported_run" ? "Reported run" : "Not reported"}`,
    "",
    "Required Supabase checks:",
    renderList(report.supabase.requiredChecks),
    "",
    "### Compatibility",
    "",
    "Sensitive areas:",
    renderList(report.compatibility.sensitiveAreas),
    "",
    "Compatibility-sensitive renames:",
    renderList((report.compatibility.renameFindings ?? []).map((finding) => `${finding.from} -> ${finding.to}`)),
    "",
    "Required compatibility checks:",
    renderList(report.compatibility.requiredChecks),
    "",
    "### Versioned Naming",
    "",
    `- Status: ${report.versionedNaming.ok ? "Pass" : "Fail"}`,
    `- Delta: ${report.versionedNaming.delta}`,
    `- Violations: ${report.versionedNaming.violationCount}`,
    `- Reductions: ${report.versionedNaming.reductionCount}`,
    "",
    "### Evidence",
    "",
    "Local commands run:",
    renderList(report.evidence.localCommandsRun),
    "",
    "Recommended local commands:",
    renderList(report.evidence.recommendedLocalCommands),
    "",
    "Optional linked read-only commands:",
    renderList(report.evidence.optionalLinkedReadOnlyCommands),
    "",
    "Manual follow-up:",
    renderList(report.evidence.manualActions),
  ].join("\n");
}

export function buildHardeningPrSummary(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const changeImpact =
    options.changeImpact ??
    analyzeChangeImpact({
      entries: options.entries ?? collectSummaryChangedEntries({ root, baseRef: options.baseRef ?? DEFAULT_BASE_REF }),
      baseRef: options.baseRef ?? DEFAULT_BASE_REF,
      strict: false,
      maxChangedEntries: 10_000,
      maxPathsPerArea: 500,
    });
  const versionedNaming =
    options.versionedNaming ??
    runVersionedNamingCheck({
      root,
    });
  const localCommandsRun = sortedUnique(options.localCommandsRun);
  const linkedReadOnlyCommandsRun = sortedUnique(options.linkedReadOnlyCommandsRun);
  const manualActions = sortedUnique([...(options.manualActions ?? []), ...DEFAULT_MANUAL_ACTIONS]);
  const productionMutationPerformed = Boolean(options.productionMutationPerformed);

  const versionedNamingSummary = summarizeVersionedNaming(versionedNaming);
  const recommendedLocalCommands = sortedUnique([
    ...DEFAULT_LOCAL_COMMANDS,
    ...(changeImpact.requiredChecks ?? []).map((check) => `npm run ${check}`),
    "npm run report:hardening-pr-summary",
  ]);
  const supabase = summarizeSupabase({ root, changeImpact, localCommandsRun });
  const compatibility = summarizeCompatibility(changeImpact);

  const report = {
    schemaVersion: 1,
    ok: versionedNamingSummary.ok,
    summary: "Generated local-only Supabase and naming review summary.",
    changeImpact,
    supabase,
    compatibility,
    versionedNaming: versionedNamingSummary,
    evidence: {
      codeVerified: localCommandsRun.length > 0,
      linkedVerified: linkedReadOnlyCommandsRun.length > 0,
      localCommandsRun,
      linkedReadOnlyCommandsRun,
      recommendedLocalCommands,
      optionalLinkedReadOnlyCommands: DEFAULT_LINKED_READ_ONLY_COMMANDS,
      manualActions,
      productionMutationPerformed,
    },
  };
  return {
    ...report,
    markdown: renderHardeningPrSummaryMarkdown(report),
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    baseRef: DEFAULT_BASE_REF,
    localCommandsRun: [],
    linkedReadOnlyCommandsRun: [],
    manualActions: [],
    productionMutationPerformed: false,
    format: "json",
    strict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--base-ref") {
      options.baseRef = argv[index + 1] ?? DEFAULT_BASE_REF;
      index += 1;
    } else if (arg.startsWith("--base-ref=")) {
      options.baseRef = arg.slice("--base-ref=".length);
    } else if (arg === "--local-command") {
      options.localCommandsRun.push(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--local-command=")) {
      options.localCommandsRun.push(arg.slice("--local-command=".length));
    } else if (arg === "--linked-command") {
      options.linkedReadOnlyCommandsRun.push(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--linked-command=")) {
      options.linkedReadOnlyCommandsRun.push(arg.slice("--linked-command=".length));
    } else if (arg === "--manual-action") {
      options.manualActions.push(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--manual-action=")) {
      options.manualActions.push(arg.slice("--manual-action=".length));
    } else if (arg === "--production-mutation-performed") {
      options.productionMutationPerformed = true;
    } else if (arg === "--format") {
      options.format = argv[index + 1] ?? "json";
      index += 1;
    } else if (arg.startsWith("--format=")) {
      options.format = arg.slice("--format=".length);
    } else if (arg === "--markdown") {
      options.format = "markdown";
    } else if (arg === "--strict") {
      options.strict = true;
    }
  }

  return options;
}

export function runHardeningPrSummary(options = parseArgs(process.argv.slice(2))) {
  const report = buildHardeningPrSummary(options);
  if (options.format === "markdown") {
    console.log(report.markdown);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  if (!report.ok && options.strict) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHardeningPrSummary();
}
