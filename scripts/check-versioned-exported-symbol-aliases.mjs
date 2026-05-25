#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVersionedExportedSymbolInventory, findExportedSymbols } from "./check-versioned-exported-symbols.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const ALIAS_BLOCK_START = "// Version-name compatibility aliases. Prefer neutral exports in new code.";
const ALIAS_BLOCK_END = "// End version-name compatibility aliases.";

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(root, rel, content) {
  fs.writeFileSync(path.join(root, rel), content);
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceForFile(root, rel) {
  return read(root, rel);
}

function existingExportNames({ root, rel }) {
  return new Set(findExportedSymbols({ rel, text: sourceForFile(root, rel) }).map((row) => row.exportedName));
}

function aliasStatement(row) {
  const localName = row.localName || row.exportedName;
  const sourceSuffix = row.sourceModule ? ` from ${JSON.stringify(row.sourceModule)}` : "";
  if (row.typeOnly) return `export type { ${localName} as ${row.suggestedNeutralName} }${sourceSuffix};`;
  return `export { ${localName} as ${row.suggestedNeutralName} }${sourceSuffix};`;
}

function rowsByPath(rows) {
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.path) ?? [];
    list.push(row);
    map.set(row.path, list);
  }
  return map;
}

function isAliasablePath(rel) {
  if (/(^|\/)__tests__\//u.test(rel)) return false;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(rel)) return false;
  return true;
}

function parseAliasBlock(text) {
  const start = text.indexOf(ALIAS_BLOCK_START);
  const end = text.indexOf(ALIAS_BLOCK_END);
  if (start < 0 || end < start) return { before: text.replace(/\s*$/u, ""), aliases: new Set(), after: "" };
  const before = text.slice(0, start).replace(/\s*$/u, "");
  const body = text.slice(start + ALIAS_BLOCK_START.length, end);
  const after = text.slice(end + ALIAS_BLOCK_END.length).replace(/^\s*/u, "");
  const aliases = new Set(
    body
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("export ")),
  );
  return { before, aliases, after };
}

function renderWithAliases(text, aliasLines) {
  const parsed = parseAliasBlock(text);
  const merged = Array.from(new Set([...parsed.aliases, ...aliasLines])).sort((a, b) => a.localeCompare(b));
  const aliasBlock = [ALIAS_BLOCK_START, ...merged, ALIAS_BLOCK_END].join("\n");
  const after = parsed.after ? `\n\n${parsed.after}` : "";
  return `${parsed.before}\n\n${aliasBlock}${after}\n`;
}

function buildCandidateRows(root) {
  const inventory = buildVersionedExportedSymbolInventory(root);
  const byPath = rowsByPath(
    inventory.symbols.filter(
      (row) =>
        isAliasablePath(row.path) &&
        row.compatibilityAction === "alias_candidate" &&
        row.manualOnly === false &&
        typeof row.suggestedNeutralName === "string" &&
        row.suggestedNeutralName.length > 0,
    ),
  );
  const pending = [];
  const blocked = [];

  for (const [rel, rows] of byPath.entries()) {
    const exportNames = existingExportNames({ root, rel });
    const seenNeutralNames = new Set();
    for (const row of rows) {
      if (exportNames.has(row.suggestedNeutralName)) {
        blocked.push({ ...row, blockReason: "neutral_export_already_exists" });
        continue;
      }
      if (seenNeutralNames.has(row.suggestedNeutralName)) {
        blocked.push({ ...row, blockReason: "duplicate_neutral_name_in_batch" });
        continue;
      }
      seenNeutralNames.add(row.suggestedNeutralName);
      pending.push({ ...row, aliasStatement: aliasStatement(row) });
    }
  }

  return { inventory, pending, blocked };
}

export function buildVersionedExportedSymbolAliasPlan(root = DEFAULT_ROOT) {
  const { inventory, pending, blocked } = buildCandidateRows(root);
  const files = Array.from(rowsByPath(pending).entries()).map(([rel, rows]) => ({
    path: toPosix(rel),
    aliasCount: rows.length,
    aliases: rows
      .map((row) => ({
        legacyName: row.exportedName,
        neutralName: row.suggestedNeutralName,
        localName: row.localName,
        typeOnly: Boolean(row.typeOnly),
        sourceModule: row.sourceModule,
        statement: row.aliasStatement,
      }))
      .sort((a, b) => a.legacyName.localeCompare(b.legacyName) || a.neutralName.localeCompare(b.neutralName)),
  }));
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-exported-symbol-aliases.mjs",
    policy:
      "Add neutral exported aliases for source-owned product-version symbols. Check mode is read-only; write mode appends alias exports without removing legacy names.",
    sourceSymbolCount: inventory.symbolCount,
    sourceAliasCandidateCount: inventory.aliasCandidateCount,
    pendingAliasCount: pending.length,
    blockedAliasCount: blocked.length,
    fileCount: files.length,
    files,
    blocked: blocked
      .map((row) => ({
        path: row.path,
        legacyName: row.exportedName,
        neutralName: row.suggestedNeutralName,
        blockReason: row.blockReason,
      }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.legacyName.localeCompare(b.legacyName)),
  };
}

function applyAliasPlan(root, plan) {
  const written = [];
  for (const file of plan.files) {
    const text = read(root, file.path);
    const next = renderWithAliases(
      text,
      file.aliases.map((row) => row.statement),
    );
    if (next !== text) {
      write(root, file.path, next);
      written.push(file.path);
    }
  }
  return written;
}

export function analyzeVersionedExportedSymbolAliases(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const plan = buildVersionedExportedSymbolAliasPlan(root);
  const issues = [];
  if (plan.pendingAliasCount > 0) {
    issues.push({
      issue: "versioned_exported_symbol_aliases_pending",
      pendingAliasCount: plan.pendingAliasCount,
      hint: "Run npm run write:versioned-exported-symbol-aliases",
    });
  }
  return {
    ok: issues.length === 0,
    pendingAliasCount: plan.pendingAliasCount,
    blockedAliasCount: plan.blockedAliasCount,
    fileCount: plan.fileCount,
    issueCount: issues.length,
    issues,
    plan,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, write: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--json") {
      options.json = true;
    }
  }
  return options;
}

export function runVersionedExportedSymbolAliases(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const plan = buildVersionedExportedSymbolAliasPlan(options.root);
    const writtenFiles = applyAliasPlan(options.root, plan);
    const report = {
      ok: true,
      wroteFileCount: writtenFiles.length,
      pendingAliasCount: plan.pendingAliasCount,
      blockedAliasCount: plan.blockedAliasCount,
      writtenFiles,
    };
    console.log(stableStringify(report));
    return report;
  }

  const report = analyzeVersionedExportedSymbolAliases(options);
  const { plan, ...printable } = report;
  const output = options.json ? report : printable;
  console.log(stableStringify(output));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedExportedSymbolAliases();
}
