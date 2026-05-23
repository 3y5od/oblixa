#!/usr/bin/env node
/**
 * Writes artifacts/security-control-coverage-matrix.rows.json from the canonical row builder.
 * Usage: node scripts/build-security-control-coverage-matrix.mjs --write
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAllCoverageRows } from "./lib/security-control-coverage-rows.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

export function buildSecurityControlCoverageMatrixPayload() {
  const rows = buildAllCoverageRows().sort((a, b) => a.sec_id.localeCompare(b.sec_id));
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.sec_id)) throw new Error(`Duplicate sec_id: ${r.sec_id}`);
    seen.add(r.sec_id);
  }
  return { version: 1, rows };
}

export function writeSecurityControlCoverageMatrix(outputPath = join(root, "artifacts/security-control-coverage-matrix.rows.json")) {
  const payload = buildSecurityControlCoverageMatrixPayload();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n");
  return { outputPath, rowCount: payload.rows.length };
}

function main() {
  const payload = buildSecurityControlCoverageMatrixPayload();
  if (!process.argv.includes("--write")) {
    console.log(`Dry run: ${payload.rows.length} rows (pass --write to emit artifacts/security-control-coverage-matrix.rows.json)`);
    return;
  }
  const jsonPath = join(root, "artifacts/security-control-coverage-matrix.rows.json");
  const result = writeSecurityControlCoverageMatrix(jsonPath);
  console.log(`Wrote ${result.outputPath} (${result.rowCount} rows)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
