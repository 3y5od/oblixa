#!/usr/bin/env node
/**
 * Epic 38 — threat-rows.json schema + evidence resolution (no silent orphans).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const threatPath = path.join(root, "artifacts", "assurance", "threat-rows.json");
const pkgPath = path.join(root, "package.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const doc = JSON.parse(fs.readFileSync(threatPath, "utf8"));
const rows = doc.rows ?? [];
const errors = [];
const now = Date.now();

function resolveEvidence(ev) {
  const m = /^npm run\s+(\S+)/.exec(ev?.trim?.() ?? "");
  if (m) {
    const name = m[1];
    if (!pkg.scripts?.[name]) {
      errors.push(`npm script not found for evidence: ${name}`);
    }
    return;
  }
  if (typeof ev === "string" && ev.startsWith("scripts/")) {
    const fsPath = path.join(root, ev);
    if (!fs.existsSync(fsPath)) errors.push(`missing file: ${ev}`);
    return;
  }
  errors.push(`unrecognized evidenceScriptOrTest format: ${JSON.stringify(ev)}`);
}

for (const row of rows) {
  if (!row.id || !row.dimensionId || !row.status || !row.owner) {
    errors.push(`row missing required fields: ${JSON.stringify(row)}`);
    continue;
  }
  if (row.status === "evidence") {
    if (!row.evidenceScriptOrTest) errors.push(`evidence row ${row.id} missing evidenceScriptOrTest`);
    else resolveEvidence(row.evidenceScriptOrTest);
  } else if (row.status === "na") {
    if (!row.naWaiverId) errors.push(`na row ${row.id} missing naWaiverId`);
    if (!row.expiresAt) errors.push(`na row ${row.id} missing expiresAt`);
    else {
      const exp = Date.parse(`${row.expiresAt}T23:59:59.999Z`);
      if (Number.isNaN(exp) || exp < now) errors.push(`na row ${row.id} expired or bad expiresAt`);
    }
    if (row.naJustification && row.naJustification.length > 280) {
      errors.push(`na row ${row.id}: naJustification exceeds 280 chars`);
    }
  } else {
    errors.push(`row ${row.id}: invalid status ${row.status}`);
  }
}

if (errors.length) {
  console.error("check-threat-row-coverage failed:\n", errors.join("\n"));
  process.exit(1);
}
console.log(`OK: threat-rows.json (${rows.length} rows).`);
