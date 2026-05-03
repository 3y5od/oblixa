#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appRoot = path.join(root, "src", "app");
const outPath = path.join(root, "artifacts", "assurance", "api-problem-json-allowlist.json");
const rawErrorPattern = /NextResponse\.json\s*\(\s*\{[\s\S]{0,240}?\berror\s*:/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "route.ts") acc.push(p);
  }
  return acc;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function loadExisting() {
  if (!fs.existsSync(outPath)) return new Map();
  const json = JSON.parse(fs.readFileSync(outPath, "utf8"));
  return new Map((json.entries ?? []).map((entry) => [entry.path, entry]));
}

const existing = loadExisting();
const entries = walk(appRoot)
  .filter((file) => rawErrorPattern.test(fs.readFileSync(file, "utf8")))
  .map(rel)
  .sort()
  .map((routePath) => {
    const prior = existing.get(routePath) ?? {};
    return {
      path: routePath,
      owner: prior.owner ?? "engineering",
      reason:
        prior.reason ??
        "Legacy raw error JSON response migration baseline; convert to shared problem helpers.",
      expiresOn: prior.expiresOn ?? "2026-12-31",
    };
  });

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  entries,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outPath)} (${entries.length} entries)`);
