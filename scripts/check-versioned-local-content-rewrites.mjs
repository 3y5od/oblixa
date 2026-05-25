#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVersionedContentContractInventory } from "./check-versioned-content-contracts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-local-content-rewrite-manifest.json";

const REFUSED_PATH_PREFIXES = [
  ".env",
  "artifacts/",
  "node_modules/",
  "openapi.yaml",
  "package-lock.json",
  "public/",
  "src/app/api/",
  "supabase/",
];

const REFUSED_SURFACES = new Set([
  "api_or_cron_contract",
  "app_route_contract",
  "environment_key",
  "external_contract",
  "openapi_schema",
  "provider_or_crypto_format",
  "sql_object",
  "telemetry_event",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Short(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(needle, index)) >= 0) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function isRefusedPath(rel) {
  return REFUSED_PATH_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(prefix));
}

function isTestPath(rel) {
  return /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(rel) || /^e2e\/.+\.spec\.[cm]?[jt]s$/u.test(rel);
}

function isScriptCommentPath(rel) {
  return /^scripts\/.+\.[cm]?js$/u.test(rel) || /^scripts\/.+\.mjs$/u.test(rel);
}

function isChecklistDoc(rel) {
  return rel === "docs/version-name-removal-code-only-checklist.md" || rel === "docs/autonomous-code-only-hardening-checklist.md";
}

function lineRewriteType(rel, line) {
  const trimmed = line.trim();
  if (isChecklistDoc(rel)) return null;
  if (/^docs\/.+\.mdx?$/u.test(rel)) return "local_documentation_copy";
  if (isTestPath(rel) && /^\s*(?:describe|it|test)\s*\(/u.test(line)) return "test_title_literal";
  if (isScriptCommentPath(rel) && /^(?:\/\/|#|\*)/u.test(trimmed)) return "script_comment";
  return null;
}

function refusal(row, reason) {
  return {
    path: row.path,
    surfaceClass: row.surfaceClass,
    subSurfaceClass: row.subSurfaceClass,
    oldValue: row.contractName,
    neutralValue: row.suggestedNeutralName ?? null,
    manualOnly: Boolean(row.manualOnly),
    reason,
  };
}

function candidateRewritesForRow(root, row) {
  if (row.manualOnly) return { rewrites: [], refusals: [refusal(row, "manual_only_surface")] };
  if (REFUSED_SURFACES.has(row.surfaceClass)) return { rewrites: [], refusals: [refusal(row, "refused_sensitive_surface")] };
  if (!row.suggestedNeutralName) return { rewrites: [], refusals: [refusal(row, "missing_suggested_neutral_name")] };
  if (isRefusedPath(row.path)) return { rewrites: [], refusals: [refusal(row, "refused_sensitive_path")] };

  const abs = path.join(root, row.path);
  if (!fs.existsSync(abs)) return { rewrites: [], refusals: [refusal(row, "stale_source_path")] };

  const text = fs.readFileSync(abs, "utf8");
  const beforeCount = countOccurrences(text, row.contractName);
  if (beforeCount === 0) return { rewrites: [], refusals: [refusal(row, "old_value_not_found")] };

  const lines = text.split(/\r?\n/u);
  const rewrites = [];
  const refusedLineHashes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes(row.contractName)) continue;
    const rewriteType = lineRewriteType(row.path, line);
    if (!rewriteType) {
      refusedLineHashes.push(sha256Short(line));
      continue;
    }
    rewrites.push({
      path: row.path,
      line: index + 1,
      evidenceHash: sha256Short(line),
      rewriteType,
      oldValue: row.contractName,
      neutralValue: row.suggestedNeutralName,
      surfaceClass: row.surfaceClass,
      subSurfaceClass: row.subSurfaceClass,
      beforeCount,
      afterCount: countOccurrences(text.replaceAll(row.contractName, row.suggestedNeutralName), row.suggestedNeutralName),
      validationCommand: row.validationCommand || "npm run check:versioned-content-contracts",
      rollbackNote: `Restore ${row.contractName} in ${row.path} if the neutral local content rewrite causes test or documentation drift.`,
    });
  }

  if (rewrites.length === 0) {
    return {
      rewrites: [],
      refusals: [
        {
          ...refusal(row, "no_manifest_safe_context"),
          refusedLineHashes: refusedLineHashes.slice(0, 5),
        },
      ],
    };
  }
  return { rewrites, refusals: [] };
}

export function buildVersionedLocalContentRewriteManifest(root = DEFAULT_ROOT) {
  const inventory = buildVersionedContentContractInventory(root);
  const rewrites = [];
  const refusals = [];

  for (const row of inventory.contracts) {
    const result = candidateRewritesForRow(root, row);
    rewrites.push(...result.rewrites);
    refusals.push(...result.refusals);
  }

  rewrites.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.line - b.line ||
      a.oldValue.localeCompare(b.oldValue) ||
      a.neutralValue.localeCompare(b.neutralValue),
  );
  refusals.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      String(a.oldValue).localeCompare(String(b.oldValue)) ||
      String(a.reason).localeCompare(String(b.reason)),
  );

  const byRewriteType = {};
  for (const row of rewrites) {
    byRewriteType[row.rewriteType] = (byRewriteType[row.rewriteType] ?? 0) + 1;
  }
  const byRefusalReason = {};
  for (const row of refusals) {
    byRefusalReason[row.reason] = (byRefusalReason[row.reason] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-local-content-rewrites.mjs --write",
    policy:
      "Local content rewrites are limited to manifest-listed documentation copy, test titles, and script comments. Runtime identifiers, public contracts, SQL, telemetry, env keys, provider config, OpenAPI, generated artifacts, and manual rows are refused.",
    pendingRewriteCount: rewrites.length,
    refusalCount: refusals.length,
    byRewriteType: Object.fromEntries(Object.entries(byRewriteType).sort(([a], [b]) => a.localeCompare(b))),
    byRefusalReason: Object.fromEntries(Object.entries(byRefusalReason).sort(([a], [b]) => a.localeCompare(b))),
    rewrites,
    refusals,
  };
}

export function applyVersionedLocalContentRewrites(root = DEFAULT_ROOT, manifest = buildVersionedLocalContentRewriteManifest(root)) {
  const byPath = new Map();
  for (const row of manifest.rewrites ?? []) {
    const rows = byPath.get(row.path) ?? [];
    rows.push(row);
    byPath.set(row.path, rows);
  }

  const applied = [];
  for (const [rel, rows] of byPath) {
    const abs = path.join(root, rel);
    const original = fs.readFileSync(abs, "utf8");
    const trailingNewline = original.endsWith("\n");
    const lines = original.split(/\r?\n/u);
    for (const row of rows) {
      const lineIndex = row.line - 1;
      const beforeLine = lines[lineIndex];
      if (typeof beforeLine !== "string") continue;
      if (sha256Short(beforeLine) !== row.evidenceHash) continue;
      const afterLine = beforeLine.replaceAll(row.oldValue, row.neutralValue);
      if (afterLine !== beforeLine) {
        lines[lineIndex] = afterLine;
        applied.push({ path: rel, line: row.line, oldValue: row.oldValue, neutralValue: row.neutralValue });
      }
    }
    fs.writeFileSync(abs, `${lines.join("\n")}${trailingNewline && lines.at(-1) !== "" ? "\n" : ""}`);
  }
  return applied;
}

function validateManifest(manifest) {
  const issues = [];
  if (manifest.schemaVersion !== 1) {
    issues.push({ issue: "versioned_local_content_rewrite_manifest_schema_version", expected: 1, actual: manifest.schemaVersion ?? null });
  }
  for (const [index, row] of (manifest.rewrites ?? []).entries()) {
    for (const key of ["path", "oldValue", "neutralValue", "rewriteType", "validationCommand", "rollbackNote", "evidenceHash"]) {
      if (typeof row[key] !== "string" || row[key].trim() === "") {
        issues.push({ issue: "versioned_local_content_rewrite_missing_metadata", index, key, path: row.path ?? null });
      }
    }
    if (!Number.isInteger(row.line) || row.line <= 0) {
      issues.push({ issue: "versioned_local_content_rewrite_invalid_line", index, path: row.path ?? null });
    }
  }
  return issues;
}

export function analyzeVersionedLocalContentRewrites(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedLocalContentRewriteManifest(root);
  const issues = validateManifest(current);
  const artifactPath = path.join(root, artifactRel);
  if (!fs.existsSync(artifactPath)) {
    issues.push({ issue: "versioned_local_content_rewrite_manifest_missing", path: artifactRel });
  } else {
    const committed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (stableStringify(committed) !== stableStringify(current)) {
      issues.push({
        issue: "versioned_local_content_rewrite_manifest_drift",
        path: artifactRel,
        hint: "Run npm run write:versioned-local-content-rewrites",
      });
    }
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    pendingRewriteCount: current.pendingRewriteCount,
    refusalCount: current.refusalCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false, apply: false };
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
    } else if (arg === "--apply") {
      options.apply = true;
    }
  }
  return options;
}

function writeArtifact(root, artifactRel, options = {}) {
  const manifest = buildVersionedLocalContentRewriteManifest(root);
  const applied = options.apply ? applyVersionedLocalContentRewrites(root, manifest) : [];
  const outputManifest = options.apply ? buildVersionedLocalContentRewriteManifest(root) : manifest;
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(outputManifest));
  return { manifest: outputManifest, applied };
}

export function runVersionedLocalContentRewrites(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const { manifest, applied } = writeArtifact(options.root, options.artifactRel, { apply: options.apply });
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.artifactRel,
          appliedRewriteCount: applied.length,
          pendingRewriteCount: manifest.pendingRewriteCount,
          refusalCount: manifest.refusalCount,
        },
        null,
        2,
      ),
    );
    return manifest;
  }
  const report = analyzeVersionedLocalContentRewrites(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedLocalContentRewrites();
}
