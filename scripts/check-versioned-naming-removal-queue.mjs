#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { governanceForVersionedNamingPath, suggestedNeutralNameForVersionedPath } from "./check-versioned-naming.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_BASELINE_REL = "scripts/versioned-naming-baseline.json";
const DEFAULT_QUEUE_REL = "scripts/versioned-naming-removal-queue.json";

function readJson(abs, fallback = null) {
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : fallback;
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validationCommandFor(surface) {
  if (surface === "api_routes") return "npm run check:compatibility-route-inventory";
  if (surface === "database_migrations" || surface === "database_seed_and_tests") return "npm run check:sql-object-reference-inventory";
  if (surface === "external_contracts") return "npm run check:generated-artifact-hygiene";
  if (surface === "tooling" || surface === "ci_workflows") return "npm run check:hardening-ci-wiring";
  if (surface === "components" || surface === "app_libraries" || surface === "server_actions" || surface === "e2e_tests") {
    return "npm run check:versioned-naming-safe-renames";
  }
  return "npm run check:versioned-naming";
}

function earliestRemovalConditionFor(governance) {
  if (governance.manualOnly) {
    return "Neutral alias exists, production/manual cutover evidence is captured, and the compatibility queue status is ready_for_removal.";
  }
  return "All source references use the neutral name, focused tests pass, and check:versioned-naming records a reduction after baseline refresh.";
}

function compatibilityClassFor(governance) {
  if (governance.manualOnly) return "compatibility_sensitive";
  if (governance.surface === "documentation") return "documentation_or_planning";
  return "source_owned";
}

function rowForBaselineFile(file) {
  const governance = file.governance ?? governanceForVersionedNamingPath(file.path);
  const suggested = file.suggestedNeutralName ?? suggestedNeutralNameForVersionedPath(file.path);
  return {
    oldName: file.path,
    neutralName: suggested?.value ?? null,
    surface: governance.surface,
    surfaceClass: governance.surface,
    compatibilityClass: compatibilityClassFor(governance),
    owner: governance.owner,
    reason: governance.reason,
    status: governance.manualOnly ? "manual_cutover_required" : "queued_for_source_cleanup",
    validationCommand: validationCommandFor(governance.surface),
    earliestRemovalCondition: earliestRemovalConditionFor(governance),
    manualFollowUp: governance.manualOnly
      ? "Create or verify a neutral alias, capture external cutover evidence, then update queue status before removing the legacy name."
      : "Apply a reviewed local rename or symbol alias and refresh the versioned naming baseline only after tests pass.",
    tokenCount: file.total ?? 0,
    tokens: file.tokens ?? {},
  };
}

export function buildVersionedNamingRemovalQueue(root = DEFAULT_ROOT, options = {}) {
  const baselineRel = options.baselineRel ?? DEFAULT_BASELINE_REL;
  const baseline = readJson(path.join(root, baselineRel), { files: [] });
  const entries = (baseline.files ?? [])
    .map(rowForBaselineFile)
    .sort((a, b) => a.surface.localeCompare(b.surface) || a.oldName.localeCompare(b.oldName));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-naming-removal-queue.mjs --write",
    sourceBaseline: baselineRel,
    entryCount: entries.length,
    entries,
    manualBoundaries: [
      "This queue does not authorize production route, provider, telemetry, or database object removals.",
      "Legacy public names remain available until their queue status is ready_for_removal and validation evidence exists.",
    ],
  };
}

function validateEntry(entry, index, issues) {
  for (const key of [
    "oldName",
    "surface",
    "surfaceClass",
    "compatibilityClass",
    "owner",
    "reason",
    "status",
    "validationCommand",
    "earliestRemovalCondition",
    "manualFollowUp",
  ]) {
    if (typeof entry[key] !== "string" || entry[key].trim() === "") {
      issues.push({ issue: "versioned_naming_removal_queue_missing_metadata", index, key, oldName: entry.oldName ?? null });
    }
  }
  if (!("neutralName" in entry)) {
    issues.push({ issue: "versioned_naming_removal_queue_missing_neutral_name_field", index, oldName: entry.oldName ?? null });
  }
}

function looksLikeRepoFilePath(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.()[\]@/-]+$/u.test(value) && value.includes("/");
}

function validateQueueStaleness(root, entries, issues) {
  for (const [index, entry] of entries.entries()) {
    if (!looksLikeRepoFilePath(entry.oldName)) continue;
    if (!fs.existsSync(path.join(root, entry.oldName))) {
      issues.push({
        issue: "versioned_naming_removal_queue_removed_file",
        index,
        oldName: entry.oldName,
        hint: "Refresh the versioned naming baseline and removal queue after the rename batch has been verified.",
      });
    }
    if (entry.status === "alias_added" && entry.neutralName && looksLikeRepoFilePath(entry.neutralName) && !fs.existsSync(path.join(root, entry.neutralName))) {
      issues.push({
        issue: "versioned_naming_removal_queue_missing_neutral_alias",
        index,
        oldName: entry.oldName,
        neutralName: entry.neutralName,
      });
    }
  }
}

export function analyzeVersionedNamingRemovalQueue(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const baselineRel = options.baselineRel ?? DEFAULT_BASELINE_REL;
  const queueRel = options.queueRel ?? DEFAULT_QUEUE_REL;
  const current = buildVersionedNamingRemovalQueue(root, { baselineRel });
  const issues = [];

  current.entries.forEach((entry, index) => validateEntry(entry, index, issues));
  validateQueueStaleness(root, current.entries, issues);

  const committed = readJson(path.join(root, queueRel), null);
  if (!committed) {
    issues.push({ issue: "versioned_naming_removal_queue_missing", path: queueRel });
  } else if (committed.schemaVersion !== 1 || !Array.isArray(committed.entries)) {
    issues.push({ issue: "invalid_versioned_naming_removal_queue_schema", path: queueRel });
  } else {
    committed.entries.forEach((entry, index) => validateEntry(entry, index, issues));
    validateQueueStaleness(root, committed.entries, issues);
    if (stableStringify(committed) !== stableStringify(current)) {
      issues.push({ issue: "versioned_naming_removal_queue_drift", path: queueRel, hint: "Run npm run write:versioned-naming-removal-queue" });
    }
  }

  return {
    ok: issues.length === 0,
    queuePath: queueRel,
    baselinePath: baselineRel,
    entryCount: current.entryCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeQueue(root, queueRel, baselineRel) {
  const queue = buildVersionedNamingRemovalQueue(root, { baselineRel });
  const out = path.join(root, queueRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(queue));
  return queue;
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    baselineRel: DEFAULT_BASELINE_REL,
    queueRel: DEFAULT_QUEUE_REL,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--baseline") {
      options.baselineRel = argv[index + 1] ?? DEFAULT_BASELINE_REL;
      index += 1;
    } else if (arg.startsWith("--baseline=")) {
      options.baselineRel = arg.slice("--baseline=".length);
    } else if (arg === "--queue") {
      options.queueRel = argv[index + 1] ?? DEFAULT_QUEUE_REL;
      index += 1;
    } else if (arg.startsWith("--queue=")) {
      options.queueRel = arg.slice("--queue=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runVersionedNamingRemovalQueue(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const queue = writeQueue(options.root, options.queueRel, options.baselineRel);
    console.log(JSON.stringify({ ok: true, wrote: options.queueRel, entryCount: queue.entryCount }, null, 2));
    return queue;
  }
  const report = analyzeVersionedNamingRemovalQueue(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedNamingRemovalQueue();
}
