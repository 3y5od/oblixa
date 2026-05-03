#!/usr/bin/env node
/**
 * Epic program closure — every epic 1..176 must appear exactly once with valid evidence or NA bulk linkage.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const closurePath = path.join(root, "artifacts", "assurance", "epic-closure.json");
const naBulkPath = path.join(root, "artifacts", "assurance", "na-bulk-registry.json");
const pkgPath = path.join(root, "package.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const pkg = loadJson(pkgPath);
const closure = loadJson(closurePath);
const naBulk = loadJson(naBulkPath);
const errors = [];

if (!Array.isArray(closure.closures) || closure.closures.length !== 176) {
  errors.push("epic-closure.json must contain closures array of length 176");
}

const seen = new Set();
for (const row of closure.closures ?? []) {
  const n = row.epicNumber;
  if (typeof n !== "number" || n < 1 || n > 176) errors.push(`bad epicNumber ${n}`);
  if (seen.has(n)) errors.push(`duplicate epic ${n}`);
  seen.add(n);
  if (row.mode === "evidence") {
    if (!row.evidence || typeof row.evidence !== "string") errors.push(`epic ${n} evidence missing`);
    else validateEvidenceCommand(row.evidence);
  } else if (row.mode === "na") {
    if (row.naBulkId !== "oblixa_maximal_na_residual_epics") {
      errors.push(`epic ${n} unexpected naBulkId ${row.naBulkId}`);
    }
  } else {
    errors.push(`epic ${n} invalid mode`);
  }
}

for (let i = 1; i <= 176; i++) {
  if (!seen.has(i)) errors.push(`missing epic ${i}`);
}

const naEntries = naBulk.entries ?? [];
const bulk = naEntries.find((e) => e.id === "oblixa_maximal_na_residual_epics");
if (!bulk) errors.push("na-bulk-registry missing oblixa_maximal_na_residual_epics entry");
else {
  for (const k of ["id", "owner", "expiresOn", "reason", "scope"]) {
    if (typeof bulk[k] !== "string" || !bulk[k].trim()) errors.push(`na bulk missing ${k}`);
  }
  const exp = Date.parse(`${bulk.expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(exp) || exp < Date.now()) errors.push("na bulk expiresOn expired");
  const covered = new Set(bulk.coveredEpicNumbers ?? []);
  const naFromClosure = new Set(
    closure.closures.filter((r) => r.mode === "na").map((r) => r.epicNumber)
  );
  for (const n of naFromClosure) {
    if (!covered.has(n)) errors.push(`NA epic ${n} missing from na-bulk coveredEpicNumbers`);
  }
  for (const n of covered) {
    if (!naFromClosure.has(n)) errors.push(`coveredEpicNumbers contains ${n} not marked NA in epic-closure`);
  }
}

function validateEvidenceCommand(cmd) {
  const trimmed = cmd.trim();
  const npmRun = /^npm run\s+(\S+)/.exec(trimmed);
  if (npmRun) {
    const name = npmRun[1];
    if (!pkg.scripts?.[name]) errors.push(`npm script missing: ${name}`);
    return;
  }
  if (trimmed.startsWith("vitest run ")) {
    const rest = trimmed.slice("vitest run ".length).trim();
    const tokens = rest.split(/\s+/);
    const paths = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "--config") {
        i += 1;
        continue;
      }
      const t = tokens[i];
      if (t.startsWith("src/") || t.startsWith("e2e/")) paths.push(t);
    }
    if (paths.length === 0) errors.push(`vitest run missing src/ or e2e/ paths: ${JSON.stringify(cmd)}`);
    for (const rel of paths) {
      const fsPath = path.join(root, rel);
      if (!fs.existsSync(fsPath)) errors.push(`vitest path missing: ${rel}`);
    }
    return;
  }
  const nodeMatches = [...trimmed.matchAll(/\bnode\s+(scripts\/[^\s]+\.mjs)/g)];
  if (nodeMatches.length > 0) {
    for (const m of nodeMatches) {
      const rel = m[1];
      if (!fs.existsSync(path.join(root, rel))) errors.push(`node script missing: ${rel}`);
    }
    return;
  }
  errors.push(`unrecognized evidence command shape: ${JSON.stringify(cmd)}`);
}

if (errors.length) {
  console.error("check-assurance-epic-closure failed:\n", errors.join("\n"));
  process.exit(1);
}

console.log("OK: epic-closure (176 epics) + na-bulk registry aligned.");
