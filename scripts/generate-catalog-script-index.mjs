#!/usr/bin/env node
/**
 * Epic 13 — Maximal debugging-sweep catalog partition → npm script map (drift-gated).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildCatalogScriptIndexPayload } from "./lib/build-catalog-script-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "artifacts", "assurance", "catalog-script-index.json");

function main() {
  const write = process.argv.includes("--write");
  const payload = buildCatalogScriptIndexPayload(root);
  if (!write) {
    console.log(JSON.stringify({ catalogCount: payload.catalogCount }, null, 2));
    console.error("Dry run. Pass --write.");
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${payload.catalogCount} catalogs to ${path.relative(root, outPath)}`);
}

main();
