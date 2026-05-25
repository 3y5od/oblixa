#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-exported-symbol-inventory.json";

const EXPORT_SCAN_ROOTS = ["src", "scripts"];
const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "artifacts",
  "blob-report",
  "coverage",
  "logs",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const SOURCE_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const PRODUCT_VERSION_SYMBOL_RE = /^(?:V\d+(?:[A-Z_]|$)|v\d+(?:[A-Z_]|$))|(?<![A-Z])V\d+(?=[A-Z_])/u;

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Short(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function walkFiles(root, dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkFiles(root, path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (SOURCE_EXTENSIONS.has(ext)) acc.push(path.join(dir, entry.name));
  }
  return acc;
}

function sourceFiles(root) {
  return EXPORT_SCAN_ROOTS.flatMap((scanRoot) => walkFiles(root, path.join(root, scanRoot))).sort((a, b) =>
    relPath(root, a).localeCompare(relPath(root, b)),
  ).filter((abs) => {
    const rel = relPath(root, abs);
    return !/(^|\/)__tests__\//u.test(rel) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(rel);
  });
}

export function isVersionedExportedSymbol(name) {
  return PRODUCT_VERSION_SYMBOL_RE.test(name);
}

export function suggestedNeutralExportName(name) {
  let next = String(name);
  next = next.replace(/^V\d+_/u, "");
  next = next.replace(/^V\d+(?=[A-Z])/u, "");
  next = next.replace(/^v\d+(?=[A-Z])/u, (prefix) => {
    void prefix;
    return "";
  });
  next = next.replace(/(?<![A-Z])V\d+(?=[A-Z_])/gu, "");
  if (/^[A-Z0-9_]+$/u.test(name)) {
    next = next.replace(/__+/gu, "_").replace(/^_/u, "");
  } else if (/^[A-Z]/u.test(name)) {
    next = next.replace(/^([a-z])/u, (match) => match.toUpperCase());
  } else {
    next = next.replace(/^([A-Z])/u, (match) => match.toLowerCase());
  }
  return next && next !== name ? next : null;
}

export function classifyExportSurface(rel) {
  if (rel.startsWith("src/app/api/")) return "api_route_export";
  if (rel.startsWith("src/app/")) return "app_route_export";
  if (rel.startsWith("src/actions/")) return "server_action_export";
  if (rel.startsWith("src/components/")) return "component_export";
  if (rel.startsWith("src/lib/product-surface/")) return "product_surface_export";
  if (rel.startsWith("src/lib/assurance/")) return "assurance_export";
  if (rel.startsWith("src/lib/decision-intelligence/")) return "decision_intelligence_export";
  if (rel.startsWith("src/lib/")) return "app_library_export";
  if (rel.startsWith("scripts/")) return "tooling_export";
  return "source_export";
}

function governanceForSurface(surface) {
  const manualOnly = new Set(["api_route_export", "app_route_export"]).has(surface);
  const ownerBySurface = {
    api_route_export: "platform-api",
    app_route_export: "frontend-platform",
    server_action_export: "platform-api",
    component_export: "frontend-platform",
    product_surface_export: "product-surface",
    assurance_export: "assurance-platform",
    decision_intelligence_export: "decision-intelligence",
    app_library_export: "platform-hardening",
    tooling_export: "platform-hardening",
    source_export: "platform-hardening",
  };
  return {
    owner: ownerBySurface[surface] ?? "platform-hardening",
    reason: manualOnly
      ? "Versioned exported symbol appears on a route-facing surface; keep a compatibility alias until callers are inventoried."
      : "Source-owned exported symbol can move to a neutral name with a deprecated compatibility alias.",
    manualOnly,
    removalStrategy: manualOnly ? "queue_alias_then_manual_cutover" : "add_neutral_export_and_update_internal_callers",
    validationCommand: "npm run check:versioned-exported-symbols",
  };
}

function lineForIndex(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function addDeclarationExports({ text, rel, rows }) {
  const declarationRe =
    /export\s+(?:declare\s+)?(?:(?:async|abstract)\s+)?(const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gu;
  let match;
  while ((match = declarationRe.exec(text)) !== null) {
    rows.push({
      path: rel,
      line: lineForIndex(text, match.index),
      exportKind: "declaration",
      declarationKind: match[1],
      typeOnly: match[1] === "interface" || match[1] === "type",
      sourceModule: null,
      exportedName: match[2],
      localName: match[2],
      sourceHash: sha256Short(text.slice(match.index, text.indexOf("\n", match.index) > -1 ? text.indexOf("\n", match.index) : text.length)),
    });
  }
}

function addNamedExports({ text, rel, rows }) {
  const namedExportRe = /export\s+(type\s+)?\{([^}]+)\}(?:\s+from\s+["']([^"']+)["'])?/gsu;
  let match;
  while ((match = namedExportRe.exec(text)) !== null) {
    const exportTypeOnly = Boolean(match[1]);
    const sourceModule = match[3] ?? null;
    for (const rawPart of match[2].split(",")) {
      const part = rawPart.trim();
      if (!part) continue;
      const partTypeOnly = /^type\s+/u.test(part);
      const pieces = part.split(/\s+as\s+/iu).map((piece) => piece.trim());
      const localName = pieces[0]?.replace(/^type\s+/u, "") ?? "";
      const exportedName = pieces[1] ?? localName;
      if (!/^[A-Za-z_$][\w$]*$/u.test(exportedName)) continue;
      rows.push({
        path: rel,
        line: lineForIndex(text, match.index),
        exportKind: "named_export",
        declarationKind: null,
        typeOnly: exportTypeOnly || partTypeOnly,
        sourceModule,
        exportedName,
        localName,
        sourceHash: sha256Short(part),
      });
    }
  }
}

export function findExportedSymbols({ rel, text }) {
  const rows = [];
  addDeclarationExports({ text, rel, rows });
  addNamedExports({ text, rel, rows });
  return rows;
}

function buildSymbolRow(row, fileExportNames) {
  const surfaceClass = classifyExportSurface(row.path);
  const governance = governanceForSurface(surfaceClass);
  const suggestedNeutralName = suggestedNeutralExportName(row.exportedName);
  const neutralExportPresent = suggestedNeutralName ? fileExportNames.has(suggestedNeutralName) : false;
  const compatibilityAction = governance.manualOnly
    ? "queue_only"
    : neutralExportPresent
      ? "alias_added"
      : "alias_candidate";
  return {
    path: row.path,
    line: row.line,
    exportKind: row.exportKind,
    declarationKind: row.declarationKind,
    typeOnly: row.typeOnly,
    sourceModule: row.sourceModule,
    exportedName: row.exportedName,
    localName: row.localName,
    sourceHash: row.sourceHash,
    surfaceClass,
    owner: governance.owner,
    reason: governance.reason,
    manualOnly: governance.manualOnly,
    removalStrategy: governance.removalStrategy,
    validationCommand: governance.validationCommand,
    suggestedNeutralName,
    neutralExportPresent,
    compatibilityAction,
  };
}

export function buildVersionedExportedSymbolInventory(root = DEFAULT_ROOT) {
  const byFile = new Map();
  for (const abs of sourceFiles(root)) {
    const rel = relPath(root, abs);
    const text = fs.readFileSync(abs, "utf8");
    const rows = findExportedSymbols({ rel, text });
    if (rows.length > 0) byFile.set(rel, rows);
  }

  const symbols = [];
  for (const [rel, rows] of byFile.entries()) {
    const fileExportNames = new Set(rows.map((row) => row.exportedName));
    for (const row of rows) {
      if (!isVersionedExportedSymbol(row.exportedName)) continue;
      symbols.push(buildSymbolRow(row, fileExportNames));
    }
  }
  symbols.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.exportedName.localeCompare(b.exportedName));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-exported-symbols.mjs --write",
    policy:
      "Inventory exported source symbols carrying product version labels. Check mode is read-only and fails only on artifact drift or malformed metadata; compatibility-sensitive exports stay queued until neutral aliases can be adopted safely.",
    symbolCount: symbols.length,
    aliasAddedCount: symbols.filter((row) => row.compatibilityAction === "alias_added").length,
    aliasCandidateCount: symbols.filter((row) => row.compatibilityAction === "alias_candidate").length,
    queueOnlyCount: symbols.filter((row) => row.compatibilityAction === "queue_only").length,
    symbols,
  };
}

function validateInventory(inventory) {
  const issues = [];
  for (const [index, row] of (inventory.symbols ?? []).entries()) {
    for (const key of [
      "path",
      "exportedName",
      "surfaceClass",
      "owner",
      "reason",
      "removalStrategy",
      "validationCommand",
      "compatibilityAction",
    ]) {
      if (typeof row[key] !== "string" || row[key].trim() === "") {
        issues.push({ issue: "versioned_exported_symbol_missing_metadata", index, key, exportedName: row.exportedName ?? null });
      }
    }
    if (typeof row.manualOnly !== "boolean") {
      issues.push({ issue: "versioned_exported_symbol_missing_manual_only", index, exportedName: row.exportedName ?? null });
    }
    if (!["alias_added", "alias_candidate", "queue_only"].includes(row.compatibilityAction)) {
      issues.push({
        issue: "versioned_exported_symbol_unknown_action",
        index,
        exportedName: row.exportedName ?? null,
        compatibilityAction: row.compatibilityAction ?? null,
      });
    }
  }
  return issues;
}

export function analyzeVersionedExportedSymbols(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedExportedSymbolInventory(root);
  const issues = validateInventory(current);
  const artifactPath = path.join(root, artifactRel);
  if (!fs.existsSync(artifactPath)) {
    issues.push({ issue: "versioned_exported_symbol_inventory_missing", path: artifactRel });
  } else {
    const committed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (stableStringify(committed) !== stableStringify(current)) {
      issues.push({ issue: "versioned_exported_symbol_inventory_drift", path: artifactRel, hint: "Run npm run write:versioned-exported-symbols" });
    }
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    symbolCount: current.symbolCount,
    aliasAddedCount: current.aliasAddedCount,
    aliasCandidateCount: current.aliasCandidateCount,
    queueOnlyCount: current.queueOnlyCount,
    issueCount: issues.length,
    issues,
    current,
  };
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

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedExportedSymbolInventory(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

export function runVersionedExportedSymbols(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.artifactRel,
          symbolCount: artifact.symbolCount,
          aliasAddedCount: artifact.aliasAddedCount,
          aliasCandidateCount: artifact.aliasCandidateCount,
          queueOnlyCount: artifact.queueOnlyCount,
        },
        null,
        2,
      ),
    );
    return artifact;
  }
  const report = analyzeVersionedExportedSymbols(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedExportedSymbols();
}
