#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/neutral-naming-rules.json";
const SAFE_RENAME_MANIFEST_REL = "artifacts/compatibility/versioned-naming-safe-rename-manifest.json";
const COMPATIBILITY_QUEUE_REL = "artifacts/compatibility/removal-queue.json";
const VERSIONED_REMOVAL_QUEUE_REL = "scripts/versioned-naming-removal-queue.json";

export const NEUTRAL_NAMING_RULES = [
  {
    id: "no_product_phase_labels_in_neutral_names",
    description: "Neutral aliases and safe rename targets must not introduce v-numbered product phase labels.",
  },
  {
    id: "no_aging_replacement_terms",
    description: "Neutral aliases must not use next, new, latest, modern, or future as replacement names.",
  },
  {
    id: "transitional_terms_require_compatibility_metadata",
    description: "current, compatibility, legacy, and release terms require queue or safe-rename compatibility metadata.",
  },
  {
    id: "canonical_old_to_neutral_mapping",
    description: "Each legacy name has one canonical neutral name in the compatibility queue.",
  },
];

const PRODUCT_VERSION_PATTERN = /\bv[0-9]+\b/iu;
const BANNED_REPLACEMENT_PATTERN = /(?:^|[-_:/])(?:next|new|latest|modern|future)(?:$|[-_:/])/iu;
const TRANSITIONAL_PATTERN = /(?:^|[-_:/])(?:current|compatibility|legacy|release)(?:$|[-_:/])/iu;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function flattenQueues(queueArtifact) {
  const rows = [];
  for (const [queueName, queueRows] of Object.entries(queueArtifact?.queues ?? {})) {
    if (!Array.isArray(queueRows)) continue;
    for (const row of queueRows) rows.push({ ...row, queueName });
  }
  return rows;
}

function safeRenameRows(manifest) {
  return (manifest?.plannedRenames ?? manifest?.renames ?? []).map((row) => ({
    surface: row.surface ?? "safe_rename",
    legacyName: row.from,
    neutralName: row.to,
    status: row.status,
    source: "safe_rename_manifest",
    manualOnly: false,
    validationCommand: "npm run check:versioned-naming-safe-renames",
  }));
}

function queueRows(queueArtifact) {
  return flattenQueues(queueArtifact)
    .filter((row) => typeof row.legacyName === "string" && Object.prototype.hasOwnProperty.call(row, "neutralAlias"))
    .map((row) => ({
      surface: row.surface ?? row.queueName,
      legacyName: row.legacyName,
      neutralName: row.neutralAlias,
      status: row.status,
      source: row.queueName,
      manualOnly: row.status !== "ready_for_removal",
      validationCommand: row.validationCommand,
    }));
}

function hasBannedReplacement(value) {
  const text = String(value ?? "");
  if (/^NEXT_PUBLIC_/u.test(text)) return false;
  return BANNED_REPLACEMENT_PATTERN.test(text);
}

function introducedBannedReplacement(row) {
  if (row.source !== "safe_rename_manifest" && row.source !== "packageScriptAliases") return false;
  if (!hasBannedReplacement(row.neutralName)) return false;
  return !hasBannedReplacement(row.legacyName);
}

function hasProductPhaseInOwnedNeutralName(row) {
  const neutralName = String(row.neutralName ?? "");
  if (!PRODUCT_VERSION_PATTERN.test(neutralName)) return false;
  if (row.source !== "safe_rename_manifest") return true;

  const legacyDir = path.dirname(String(row.legacyName ?? ""));
  const neutralDir = path.dirname(neutralName);
  const neutralBase = path.basename(neutralName);
  if (legacyDir === neutralDir && !PRODUCT_VERSION_PATTERN.test(neutralBase)) {
    return false;
  }
  return true;
}

function transitionalTermAllowed(row) {
  if (!TRANSITIONAL_PATTERN.test(String(row.neutralName ?? ""))) return true;
  if (TRANSITIONAL_PATTERN.test(String(row.legacyName ?? ""))) return true;
  if (row.source === "packageScriptAliases") return true;
  if (row.source === "safe_rename_manifest") return true;
  if (String(row.status ?? "") === "alias_added" || String(row.status ?? "") === "awaiting_production_cutover") return true;
  if (String(row.surface ?? "").includes("compatibility")) return true;
  return false;
}

function canonicalMappingIssues(rows) {
  const issues = [];
  const byLegacy = new Map();
  for (const row of rows.filter((candidate) => candidate.source === "safe_rename_manifest" || candidate.source === "packageScriptAliases")) {
    if (!row.legacyName || !row.neutralName) continue;
    const key = row.legacyName;
    const set = byLegacy.get(key) ?? new Set();
    set.add(row.neutralName);
    byLegacy.set(key, set);
  }
  for (const [legacyName, values] of byLegacy.entries()) {
    if (values.size > 1) {
      issues.push({
        issue: "neutral_naming_multiple_canonical_names",
        legacyName,
        neutralAliases: Array.from(values).sort((a, b) => a.localeCompare(b)),
      });
    }
  }
  return issues;
}

export function buildNeutralNamingRules(root = DEFAULT_ROOT, options = {}) {
  const safeRenameManifest = options.safeRenameManifest ?? readJson(root, options.safeRenameManifestRel ?? SAFE_RENAME_MANIFEST_REL, {});
  const compatibilityQueue = options.compatibilityQueue ?? readJson(root, options.compatibilityQueueRel ?? COMPATIBILITY_QUEUE_REL, {});
  const versionedRemovalQueue = options.versionedRemovalQueue ?? readJson(root, options.versionedRemovalQueueRel ?? VERSIONED_REMOVAL_QUEUE_REL, {});
  const candidates = [...safeRenameRows(safeRenameManifest), ...queueRows(compatibilityQueue)]
    .sort((a, b) => `${a.source}:${a.legacyName}`.localeCompare(`${b.source}:${b.legacyName}`));

  const issues = [];
  for (const row of candidates) {
    if (hasProductPhaseInOwnedNeutralName(row)) {
      issues.push({ issue: "neutral_naming_product_phase_in_neutral_name", legacyName: row.legacyName, neutralName: row.neutralName });
    }
    if (introducedBannedReplacement(row)) {
      issues.push({ issue: "neutral_naming_aging_replacement_term", legacyName: row.legacyName, neutralName: row.neutralName });
    }
    if (!transitionalTermAllowed(row)) {
      issues.push({ issue: "neutral_naming_unclassified_transitional_term", legacyName: row.legacyName, neutralName: row.neutralName });
    }
    if (typeof row.validationCommand !== "string" || row.validationCommand.trim() === "") {
      issues.push({ issue: "neutral_naming_missing_validation_command", legacyName: row.legacyName, neutralName: row.neutralName });
    }
  }
  issues.push(...canonicalMappingIssues(candidates));

  const queuedEntries = versionedRemovalQueue?.entries ?? versionedRemovalQueue?.queue ?? [];
  const renameableWithoutNeutral = queuedEntries
    .filter((row) => row?.manualOnly === false)
    .filter((row) => row?.suggestedNeutralName === null || row?.suggestedNeutralName === undefined);
  for (const row of renameableWithoutNeutral) {
    issues.push({
      issue: "neutral_naming_missing_suggested_neutral_name",
      path: row.path ?? null,
      surface: row.surface ?? row.surfaceClass ?? null,
    });
  }

  const transitionalUseCount = candidates.filter((row) => TRANSITIONAL_PATTERN.test(String(row.neutralName ?? ""))).length;
  const bannedReplacementCount = candidates.filter((row) => introducedBannedReplacement(row)).length;

  return {
    schemaVersion: 1,
    generatedBy: "check:neutral-naming-rules",
    rules: NEUTRAL_NAMING_RULES,
    candidateCount: candidates.length,
    transitionalUseCount,
    bannedReplacementCount,
    renameableWithoutNeutralCount: renameableWithoutNeutral.length,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeNeutralNamingRules(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildNeutralNamingRules(root, options);
  const issues = [...current.issues];
  const artifactPath = path.join(root, artifactRel);
  const committed = readJson(root, artifactRel, null);
  if (!committed) {
    issues.push({ issue: "neutral_naming_rules_missing_artifact", path: artifactRel });
  } else if (stableStringify(committed) !== stableStringify({ ...current, issueCount: current.issues.length })) {
    issues.push({ issue: "neutral_naming_rules_drift", path: artifactRel, hint: "Run npm run write:neutral-naming-rules" });
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    ruleCount: NEUTRAL_NAMING_RULES.length,
    candidateCount: current.candidateCount,
    transitionalUseCount: current.transitionalUseCount,
    bannedReplacementCount: current.bannedReplacementCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel) {
  const artifact = buildNeutralNamingRules(root);
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

export function runNeutralNamingRules(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(JSON.stringify({
      ok: true,
      wrote: options.artifactRel,
      ruleCount: artifact.rules.length,
      candidateCount: artifact.candidateCount,
      issueCount: artifact.issueCount,
    }, null, 2));
    return artifact;
  }

  const report = analyzeNeutralNamingRules(options);
  const { current: _current, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runNeutralNamingRules();
}
