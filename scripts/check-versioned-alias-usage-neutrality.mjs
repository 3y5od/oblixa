#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ENV_KEY_ALIASES,
  EXPORTED_SYMBOL_ALIASES,
  PACKAGE_SCRIPT_ALIASES,
  buildCompatibilityRemovalQueue,
} from "./check-compatibility-removal-queue.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-alias-usage-neutrality.json";

const SCAN_ROOTS = [".github", "config", "e2e", "scripts", "src", "package.json"];
const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "artifacts",
  "blob-report",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function readJson(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : null;
}

function walk(root, rel, acc = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return acc;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (rel === "package.json" || TEXT_EXTENSIONS.has(path.extname(rel))) acc.push(toPosix(rel));
    return acc;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(root, path.join(rel, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    const childRel = toPosix(path.join(rel, entry.name));
    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) acc.push(childRel);
  }
  return acc;
}

function scanFiles(root) {
  return Array.from(new Set(SCAN_ROOTS.flatMap((scanRoot) => walk(root, scanRoot)))).sort((a, b) => a.localeCompare(b));
}

function occurrenceCount(text, needle, mode) {
  if (!needle) return 0;
  if (mode === "identifier") {
    const pattern = new RegExp(`(?<![A-Za-z0-9_$])${needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![A-Za-z0-9_$])`, "gu");
    return text.match(pattern)?.length ?? 0;
  }
  return text.split(needle).length - 1;
}

function referenceRows(root, alias) {
  const rows = [];
  for (const rel of scanFiles(root)) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const legacyCount = occurrenceCount(text, alias.legacyName, alias.matchMode);
    const neutralCount = occurrenceCount(text, alias.neutralAlias, alias.matchMode);
    if (legacyCount === 0 && neutralCount === 0) continue;
    rows.push({
      path: rel,
      legacyCount,
      neutralCount,
      referenceClass:
        rel === "package.json"
          ? "package_metadata"
          : rel.startsWith(".github/")
            ? "ci_or_workflow"
            : rel.startsWith("scripts/")
              ? "tooling_or_governance"
              : rel.startsWith("src/")
                ? "source_or_test"
                : "repo_local",
    });
  }
  return rows;
}

function queueRows(queueArtifact, queueName) {
  return Array.isArray(queueArtifact?.queues?.[queueName]) ? queueArtifact.queues[queueName] : [];
}

function queueHasAlias(queueArtifact, queueName, alias) {
  return queueRows(queueArtifact, queueName).some(
    (row) => row.legacyName === alias.legacyName && row.neutralAlias === alias.neutralAlias,
  );
}

function aliasRows() {
  return [
    ...PACKAGE_SCRIPT_ALIASES.map((alias) => ({
      surface: "package_script",
      queueName: "packageScriptAliases",
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      matchMode: "string",
      owner: "platform-hardening",
      validationCommand: `npm run ${alias.neutral}`,
    })),
    ...ENV_KEY_ALIASES.map((alias) => ({
      surface: "environment_key",
      queueName: "environmentKeys",
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      matchMode: "string",
      owner: alias.owner,
      validationCommand: alias.validationCommand,
    })),
    ...EXPORTED_SYMBOL_ALIASES.map((alias) => ({
      surface: "exported_symbol_alias",
      queueName: "exportedSymbolAliases",
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      matchMode: "identifier",
      owner: alias.owner,
      validationCommand: alias.validationCommand,
    })),
  ].sort((a, b) => a.surface.localeCompare(b.surface) || a.legacyName.localeCompare(b.legacyName));
}

function buildArtifact(root = DEFAULT_ROOT) {
  const queueArtifact = buildCompatibilityRemovalQueue(root);
  const issues = [];
  const aliases = aliasRows().map((alias) => {
    const references = referenceRows(root, alias);
    const legacyReferenceCount = references.reduce((sum, row) => sum + row.legacyCount, 0);
    const neutralReferenceCount = references.reduce((sum, row) => sum + row.neutralCount, 0);
    const queueCovered = queueHasAlias(queueArtifact, alias.queueName, alias);
    if (!queueCovered) {
      issues.push({
        issue: "versioned_alias_usage_neutrality_missing_queue_coverage",
        surface: alias.surface,
        legacyName: alias.legacyName,
        neutralAlias: alias.neutralAlias,
      });
    }
    if (neutralReferenceCount === 0) {
      issues.push({
        issue: "versioned_alias_usage_neutrality_missing_neutral_usage_or_alias",
        surface: alias.surface,
        legacyName: alias.legacyName,
        neutralAlias: alias.neutralAlias,
      });
    }
    return {
      surface: alias.surface,
      legacyName: alias.legacyName,
      neutralAlias: alias.neutralAlias,
      owner: alias.owner,
      queueCovered,
      legacyReferenceCount,
      neutralReferenceCount,
      referenceFileCount: references.length,
      retainedLegacyStatus: legacyReferenceCount > 0 ? "retained_compatibility_alias" : "neutral_only",
      validationCommand: alias.validationCommand,
      references,
    };
  });

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-alias-usage-neutrality.mjs --write",
    policy:
      "Repo-local callers should prefer neutral aliases. Legacy aliases remain callable/readable only when queue-covered and compatibility-sensitive.",
    sourceArtifacts: {
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
      exportedSymbolInventory: "artifacts/compatibility/versioned-exported-symbol-inventory.json",
      telemetryInventory: "artifacts/telemetry/event-inventory.json",
      routeInventory: "artifacts/routes/compatibility-route-inventory.json",
    },
    totals: {
      aliasCount: aliases.length,
      queueCoveredCount: aliases.filter((row) => row.queueCovered).length,
      retainedLegacyAliasCount: aliases.filter((row) => row.legacyReferenceCount > 0).length,
      neutralOnlyAliasCount: aliases.filter((row) => row.legacyReferenceCount === 0).length,
      legacyReferenceCount: aliases.reduce((sum, row) => sum + row.legacyReferenceCount, 0),
      neutralReferenceCount: aliases.reduce((sum, row) => sum + row.neutralReferenceCount, 0),
      issueCount: issues.length,
    },
    aliases,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedAliasUsageNeutrality(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildArtifact(root);
  const issues = [...current.issues];
  const committed = readJson(root, artifactRel);
  if (!committed) {
    issues.push({ issue: "versioned_alias_usage_neutrality_missing_artifact", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({
      issue: "versioned_alias_usage_neutrality_drift",
      path: artifactRel,
      hint: "Run npm run write:versioned-alias-usage-neutrality",
    });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    aliasCount: current.totals.aliasCount,
    retainedLegacyAliasCount: current.totals.retainedLegacyAliasCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildArtifact(root);
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

export function runVersionedAliasUsageNeutrality(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(stableStringify(artifact).trimEnd());
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeVersionedAliasUsageNeutrality(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedAliasUsageNeutrality();
}
