#!/usr/bin/env node
/**
 * Validates config/qa-maximal-sweep-track-registry.json: exactly p0–p210, npm evidence exists in package.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const p = path.join(root, "config", "qa-maximal-sweep-track-registry.json");
if (!fs.existsSync(p)) {
  console.error(JSON.stringify({ ok: false, reason: "missing_registry", path: p }, null, 2));
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(p, "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = pkg.scripts || {};

const expected = [];
for (let i = 0; i <= 210; i += 1) expected.push(`p${i}`);

const keys = Object.keys(data.tracks || {}).sort();
const missing = expected.filter((k) => !data.tracks[k]);
const extra = keys.filter((k) => !expected.includes(k));

const badScripts = [];
for (const id of expected) {
  const row = data.tracks[id];
  if (!row || !Array.isArray(row.npm) || row.npm.length === 0) {
    badScripts.push({ id, reason: "missing_npm_array" });
    continue;
  }
  for (const s of row.npm) {
    if (typeof s !== "string" || !(s in scripts)) badScripts.push({ id, script: s, reason: "unknown_script" });
  }
}

const ok = missing.length === 0 && extra.length === 0 && badScripts.length === 0;
const payload = {
  checkId: "qa-maximal-sweep-track-registry",
  ok,
  expectedTracks: expected.length,
  actualTracks: keys.length,
  missing,
  extra,
  badScripts: badScripts.slice(0, 30),
  badScriptsTruncated: badScripts.length > 30,
};

console.log(JSON.stringify(payload, null, 2));

process.exit(ok ? 0 : 1);
