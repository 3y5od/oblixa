#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PACKAGE_SCRIPT_ALIASES } from "./check-compatibility-removal-queue.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-package-script-readiness.json";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "artifacts",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonl",
  ".jsx",
  ".md",
  ".mdc",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const NON_BLOCKING_REFERENCE_PATHS = new Set([
  DEFAULT_ARTIFACT_REL,
  "artifacts/compatibility/removal-queue.json",
  "scripts/check-compatibility-removal-queue.mjs",
  "scripts/check-versioned-package-script-readiness.mjs",
  "scripts/check-versioned-package-script-readiness.test.mjs",
]);

const BLOCKER_CATEGORIES = [
  "repo_local",
  "docs_only",
  "generated_artifact",
  "external_or_manual",
  "ready_for_removal",
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function toPosix(value) {
  return value.replace(/\\/gu, "/");
}

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walkTextFiles(root, dir = root, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkTextFiles(root, path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = toPosix(path.relative(root, path.join(dir, entry.name)));
    if (rel === "package.json") continue;
    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) acc.push(rel);
  }
  return acc.sort((a, b) => a.localeCompare(b));
}

function referenceClass(rel) {
  if (rel.startsWith("docs/") || rel === "README.md" || rel.endsWith(".md") || rel.endsWith(".mdc")) return "documentation";
  if (rel.startsWith("artifacts/") || rel.includes("baseline") || rel.includes("manifest") || rel.includes("inventory")) return "generated_artifact";
  if (rel.startsWith(".github/") || rel.startsWith("config/")) return "ci_or_config";
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx") || rel.startsWith("e2e/")) return "test";
  if (rel.startsWith("scripts/")) return "tooling";
  return "source";
}

function referencesForScript(root, scriptName, files = walkTextFiles(root)) {
  return files
    .filter((rel) => {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      return text.includes(scriptName);
    })
    .map((pathName) => ({ path: pathName, class: referenceClass(pathName) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function isBlockingReference(row) {
  if (NON_BLOCKING_REFERENCE_PATHS.has(row.path)) return false;
  if (row.path.startsWith("artifacts/compatibility/")) return false;
  return true;
}

function blockerCategory(row) {
  if (!isBlockingReference(row)) return null;
  if (row.class === "documentation") return "docs_only";
  if (row.class === "generated_artifact") return "generated_artifact";
  if (["ci_or_config", "source", "test", "tooling"].includes(row.class)) return "repo_local";
  return "external_or_manual";
}

function countByCategory(rows) {
  const counts = Object.fromEntries(BLOCKER_CATEGORIES.map((category) => [category, 0]));
  for (const row of rows) {
    const category = row.blockerCategory ?? blockerCategory(row);
    if (!category) continue;
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function readinessStatusForCounts(counts, readyForRemoval) {
  if (readyForRemoval) return "ready_for_removal";
  if ((counts.repo_local ?? 0) > 0) return "blocked_by_repo_local_references";
  if ((counts.external_or_manual ?? 0) > 0) return "blocked_by_external_or_manual_references";
  if ((counts.docs_only ?? 0) > 0 || (counts.generated_artifact ?? 0) > 0) {
    return "blocked_by_docs_or_generated_references";
  }
  return "blocked_by_manual_follow_up";
}

function readinessBlockerForCounts(counts, readyForRemoval) {
  if (readyForRemoval) return "No repo-local, docs-only, generated, external, or manual blockers remain.";
  if ((counts.repo_local ?? 0) > 0) {
    return `${counts.repo_local} repo-local reference(s) still point at the legacy package script.`;
  }
  if ((counts.external_or_manual ?? 0) > 0) {
    return `${counts.external_or_manual} external/manual reference(s) still point at the legacy package script.`;
  }
  if ((counts.docs_only ?? 0) > 0 || (counts.generated_artifact ?? 0) > 0) {
    return `${(counts.docs_only ?? 0) + (counts.generated_artifact ?? 0)} docs-only/generated reference(s) still mention the legacy package script.`;
  }
  return "No repo-local blocking references remain, but external branch protection, runbooks, and manual compatibility evidence have not approved removal.";
}

function aliasDirection(scripts, alias) {
  if (scripts[alias.legacy] === `npm run ${alias.neutral}`) return "legacy_to_neutral";
  if (scripts[alias.neutral] === `npm run ${alias.legacy}`) return "neutral_to_legacy";
  return "direct_or_mixed";
}

export function buildVersionedPackageScriptReadiness(root = DEFAULT_ROOT) {
  const pkg = readJson(path.join(root, "package.json"), { scripts: {} });
  const scripts = pkg.scripts ?? {};
  const files = walkTextFiles(root);
  const aliases = PACKAGE_SCRIPT_ALIASES.map((alias) => {
    const references = referencesForScript(root, alias.legacy, files);
    const blockingReferences = references
      .map((row) => ({ ...row, blockerCategory: blockerCategory(row) }))
      .filter((row) => row.blockerCategory);
    const blockerCategoryCounts = countByCategory(blockingReferences);
    const bridge = aliasDirection(scripts, alias);
    const legacyCommand = scripts[alias.legacy] ?? null;
    const neutralCommand = scripts[alias.neutral] ?? null;
    const bridgeOk = bridge === "legacy_to_neutral" || bridge === "neutral_to_legacy";
    const locallyReady = Boolean(
      legacyCommand &&
        neutralCommand &&
        bridgeOk &&
        (blockerCategoryCounts.repo_local ?? 0) === 0 &&
        (blockerCategoryCounts.external_or_manual ?? 0) === 0,
    );
    const readyForRemoval = false;
    const readinessStatus = readinessStatusForCounts(blockerCategoryCounts, readyForRemoval);

    return {
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      owner: "platform-hardening",
      status: readyForRemoval ? "ready_for_removal" : "alias_added",
      readinessStatus,
      readinessBlocker: readinessBlockerForCounts(blockerCategoryCounts, readyForRemoval),
      localReadyForRemoval: locallyReady,
      validationCommands: {
        legacy: `npm run ${alias.legacy}`,
        neutral: `npm run ${alias.neutral}`,
      },
      earliestRemovalCondition:
        "All repo-local references use the neutral command and external runbooks/branch protection evidence no longer require the legacy command.",
      manualFollowUp: "Remove the legacy package-script alias only after this row reports ready_for_removal.",
      legacyCommand,
      neutralCommand,
      aliasDirection: bridge,
      referenceCount: references.length,
      blockingReferenceCount: blockingReferences.length,
      repoLocalReferenceCount: blockerCategoryCounts.repo_local ?? 0,
      docsOnlyReferenceCount: blockerCategoryCounts.docs_only ?? 0,
      generatedArtifactReferenceCount: blockerCategoryCounts.generated_artifact ?? 0,
      externalOrManualReferenceCount: blockerCategoryCounts.external_or_manual ?? 0,
      blockerCategoryCounts,
      references,
      blockingReferences,
    };
  }).sort((a, b) => a.legacyName.localeCompare(b.legacyName));

  const byStatus = {};
  const byBlockingClass = {};
  const byBlockerCategory = Object.fromEntries(BLOCKER_CATEGORIES.map((category) => [category, 0]));
  for (const row of aliases) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    for (const ref of row.blockingReferences) {
      byBlockingClass[ref.class] = (byBlockingClass[ref.class] ?? 0) + 1;
      byBlockerCategory[ref.blockerCategory] = (byBlockerCategory[ref.blockerCategory] ?? 0) + 1;
    }
  }

  return {
    schemaVersion: 2,
    generatedBy: "check:versioned-package-script-readiness",
    source: "package.json and PACKAGE_SCRIPT_ALIASES",
    aliasCount: aliases.length,
    readyForRemovalCount: aliases.filter((row) => row.status === "ready_for_removal").length,
    localReadyForRemovalCount: aliases.filter((row) => row.localReadyForRemoval).length,
    blockedAliasCount: aliases.filter((row) => row.status !== "ready_for_removal").length,
    blockingReferenceCount: aliases.reduce((sum, row) => sum + row.blockingReferenceCount, 0),
    repoLocalReferenceCount: aliases.reduce((sum, row) => sum + row.repoLocalReferenceCount, 0),
    docsOnlyReferenceCount: aliases.reduce((sum, row) => sum + row.docsOnlyReferenceCount, 0),
    generatedArtifactReferenceCount: aliases.reduce((sum, row) => sum + row.generatedArtifactReferenceCount, 0),
    externalOrManualReferenceCount: aliases.reduce((sum, row) => sum + row.externalOrManualReferenceCount, 0),
    byStatus: Object.fromEntries(Object.entries(byStatus).sort(([a], [b]) => a.localeCompare(b))),
    byBlockingClass: Object.fromEntries(Object.entries(byBlockingClass).sort(([a], [b]) => a.localeCompare(b))),
    byBlockerCategory: Object.fromEntries(Object.entries(byBlockerCategory).sort(([a], [b]) => a.localeCompare(b))),
    aliases,
  };
}

export function analyzeVersionedPackageScriptReadiness(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedPackageScriptReadiness(root);
  const issues = [];
  const scripts = readJson(path.join(root, "package.json"), { scripts: {} }).scripts ?? {};

  for (const row of current.aliases) {
    if (!scripts[row.legacyName]) {
      issues.push({ issue: "versioned_package_script_legacy_missing", script: row.legacyName });
    }
    if (!scripts[row.neutralAlias]) {
      issues.push({ issue: "versioned_package_script_neutral_missing", script: row.neutralAlias });
    }
    if (row.aliasDirection === "direct_or_mixed") {
      issues.push({
        issue: "versioned_package_script_alias_bridge_missing",
        legacyName: row.legacyName,
        neutralAlias: row.neutralAlias,
      });
    }
    for (const key of ["owner", "status", "readinessStatus", "readinessBlocker", "earliestRemovalCondition", "manualFollowUp"]) {
      if (typeof row[key] !== "string" || row[key].trim() === "") {
        issues.push({ issue: "versioned_package_script_readiness_missing_metadata", script: row.legacyName, key });
      }
    }
    for (const category of BLOCKER_CATEGORIES.filter((entry) => entry !== "ready_for_removal")) {
      if (typeof row.blockerCategoryCounts?.[category] !== "number") {
        issues.push({ issue: "versioned_package_script_readiness_missing_blocker_category", script: row.legacyName, category });
      }
    }
    if (row.status === "ready_for_removal" && row.repoLocalReferenceCount > 0) {
      issues.push({
        issue: "versioned_package_script_ready_with_repo_local_references",
        script: row.legacyName,
        repoLocalReferenceCount: row.repoLocalReferenceCount,
      });
    }
  }

  const artifactPath = path.join(root, artifactRel);
  const committed = readJson(artifactPath, null);
  if (!committed) {
    issues.push({ issue: "versioned_package_script_readiness_missing_artifact", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({
      issue: "versioned_package_script_readiness_drift",
      path: artifactRel,
      hint: "Run npm run write:versioned-package-script-readiness",
    });
    for (const row of committed.aliases ?? []) {
      for (const ref of row.blockingReferences ?? []) {
        const abs = path.join(root, ref.path ?? "");
        if (typeof ref.path !== "string" || ref.path.trim() === "" || !fs.existsSync(abs)) {
          issues.push({
            issue: "versioned_package_script_readiness_stale_reference_path",
            script: row.legacyName ?? null,
            path: ref.path ?? null,
          });
          continue;
        }
        const text = fs.readFileSync(abs, "utf8");
        if (typeof row.legacyName === "string" && !text.includes(row.legacyName)) {
          issues.push({
            issue: "versioned_package_script_readiness_stale_reference_name",
            script: row.legacyName,
            path: ref.path,
          });
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    aliasCount: current.aliasCount,
    readyForRemovalCount: current.readyForRemovalCount,
    localReadyForRemovalCount: current.localReadyForRemovalCount,
    blockedAliasCount: current.blockedAliasCount,
    blockingReferenceCount: current.blockingReferenceCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedPackageScriptReadiness(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
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

export function runVersionedPackageScriptReadiness(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(JSON.stringify({
      ok: true,
      wrote: options.artifactRel,
      aliasCount: artifact.aliasCount,
      readyForRemovalCount: artifact.readyForRemovalCount,
      localReadyForRemovalCount: artifact.localReadyForRemovalCount,
      blockedAliasCount: artifact.blockedAliasCount,
      blockingReferenceCount: artifact.blockingReferenceCount,
      repoLocalReferenceCount: artifact.repoLocalReferenceCount,
    }, null, 2));
    return artifact;
  }

  const report = analyzeVersionedPackageScriptReadiness(options);
  const { current: _current, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedPackageScriptReadiness();
}
