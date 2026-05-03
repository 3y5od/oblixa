#!/usr/bin/env node
/** Epic 5 — Validate rls-sanity-tables.json envelope (tables[] strings when present). */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const p = path.join(root, "artifacts", "assurance", "rls-sanity-tables.json");
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const errors = [];
if (j.version !== 1) errors.push("version must be 1");
if (!Array.isArray(j.tables)) errors.push("tables must be array");
else {
  for (const t of j.tables) {
    if (typeof t !== "string" || !t.trim()) errors.push(`invalid table entry ${JSON.stringify(t)}`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: rls-sanity-tables registry (${j.tables.length} rows).`);
