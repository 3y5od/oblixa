#!/usr/bin/env node
/**
 * Writes artifacts/security-control-coverage-matrix.rows.json from the canonical row builder.
 * Usage: node scripts/build-security-control-coverage-matrix.mjs --write
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllCoverageRows } from "./lib/security-control-coverage-rows.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function main() {
  const rows = buildAllCoverageRows();
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.sec_id)) throw new Error(`Duplicate sec_id: ${r.sec_id}`);
    seen.add(r.sec_id);
  }
  if (!process.argv.includes("--write")) {
    console.log(`Dry run: ${rows.length} rows (pass --write to emit artifacts/security-control-coverage-matrix.rows.json)`);
    return;
  }
  const payload = { version: 1, generated: new Date().toISOString(), rows };
  const jsonPath = join(root, "artifacts/security-control-coverage-matrix.rows.json");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${jsonPath} (${rows.length} rows)`);
}

main();
