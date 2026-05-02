#!/usr/bin/env node
/**
 * Ensures every `artifacts` tree `.json` file is valid JSON (manifest hygiene; appendix R).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "artifacts");

/** @param {string} d @param {string[]} out */
function collectJsonFiles(d, out) {
  if (!fs.existsSync(d)) return;
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, ent.name);
    if (ent.isDirectory()) collectJsonFiles(full, out);
    else if (ent.isFile() && ent.name.endsWith(".json")) out.push(full);
  }
}

const files = [];
collectJsonFiles(dir, files);
files.sort();
const bad = [];
for (const full of files) {
  const rel = path.relative(root, full);
  try {
    JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    bad.push({ file: rel, error: String(e?.message || e) });
  }
}
const ok = bad.length === 0;
console.log(
  JSON.stringify({ ok, checkId: "artifact-json-matrix", scanned: files.length, bad }, null, 2)
);
process.exit(ok ? 0 : 1);
