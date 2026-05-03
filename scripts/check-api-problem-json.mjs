#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const appRoot = path.join(root, "src", "app");
const allowlistPath = path.join(root, "artifacts", "assurance", "api-problem-json-allowlist.json");
const rawErrorPattern = /NextResponse\.json\s*\(\s*\{[\s\S]{0,240}?\berror\s*:/;
const today = new Date().toISOString().slice(0, 10);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "route.ts") {
      acc.push(p);
    }
  }
  return acc;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) {
    return { version: 1, entries: [] };
  }
  return JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
}

const routeFiles = walk(appRoot).sort((a, b) => a.localeCompare(b));
const rawErrorFiles = routeFiles
  .filter((file) => rawErrorPattern.test(fs.readFileSync(file, "utf8")))
  .map(rel)
  .sort();

const allowlist = loadAllowlist();
const entries = Array.isArray(allowlist.entries) ? allowlist.entries : [];
const allowlisted = new Set(entries.map((entry) => entry.path));
const rawSet = new Set(rawErrorFiles);
const errors = [];

for (const entry of entries) {
  if (typeof entry.path !== "string" || !entry.path.endsWith("/route.ts")) {
    errors.push(`allowlist entry has invalid path: ${JSON.stringify(entry.path)}`);
    continue;
  }
  if (entry.path.includes("*")) errors.push(`${entry.path}: wildcard paths are not allowed`);
  if (typeof entry.owner !== "string" || entry.owner.trim().length < 2) {
    errors.push(`${entry.path}: missing owner`);
  }
  if (typeof entry.reason !== "string" || entry.reason.trim().length < 12) {
    errors.push(`${entry.path}: missing specific reason`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.expiresOn ?? ""))) {
    errors.push(`${entry.path}: expiresOn must be YYYY-MM-DD`);
  } else if (entry.expiresOn < today) {
    errors.push(`${entry.path}: allowlist expired on ${entry.expiresOn}`);
  }
  if (!rawSet.has(entry.path)) {
    errors.push(`${entry.path}: stale allowlist entry (no raw NextResponse.json({ error }) match)`);
  }
}

for (const file of rawErrorFiles) {
  if (!allowlisted.has(file)) {
    errors.push(`${file}: raw error JSON must migrate to jsonProblem/jsonOk or be explicitly allowlisted`);
  }
}

const payload = {
  ok: errors.length === 0,
  routeTsFiles: routeFiles.length,
  rawErrorRouteFiles: rawErrorFiles.length,
  allowlistedRawErrorRouteFiles: entries.length,
  errors: errors.slice(0, 80),
};
console.log(JSON.stringify(payload, null, 2));

if (errors.length) {
  if (errors.length > 80) console.error(`... ${errors.length - 80} more`);
  console.error("Run npm run generate:api-problem-json-allowlist for the legacy baseline, or migrate routes.");
  process.exit(1);
}
