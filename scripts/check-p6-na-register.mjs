#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const p = path.join(root, "config", "p6-explicit-na-register.json");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const j = JSON.parse(fs.readFileSync(p, "utf8"));
if (!Array.isArray(j.rows) || j.rows.length === 0) fail("p6-explicit-na-register: rows must be non-empty array");
for (const row of j.rows) {
  if (!row.control_id || typeof row.control_id !== "string") fail("row missing control_id");
  if (!row.n_a_rationale || typeof row.n_a_rationale !== "string") fail(`row ${row.control_id}: n_a_rationale required`);
  if (!row.n_a_reviewed_at || typeof row.n_a_reviewed_at !== "string") fail(`row ${row.control_id}: n_a_reviewed_at required`);
  if (!Array.isArray(row.domain_tags) || row.domain_tags.length === 0) {
    fail(`row ${row.control_id}: domain_tags must be non-empty array`);
  }
}
console.log(`OK: p6 explicit N/A register (${j.rows.length} row(s)).`);
