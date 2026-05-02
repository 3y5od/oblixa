#!/usr/bin/env node
/**
 * Validates workflow YAML references `npm run <script>` where <script> exists in package.json.
 * Optional strict: QA_SWEEP_TIER / QA_ULTIMATE_TIER values must be known tier ids.
 */
import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const strict = process.argv.includes("--strict");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = pkg.scripts || {};

const manifest = JSON.parse(fs.readFileSync(path.join(root, "config", "qa-tier-manifest.json"), "utf8"));
const knownTiers = new Set(Object.keys(manifest.tiers || {}));

const wfDir = path.join(root, ".github", "workflows");
const files = fs.existsSync(wfDir) ? walkFiles(wfDir, (abs) => abs.endsWith(".yml") || abs.endsWith(".yaml")) : [];

const missing = [];
const badTierRefs = [];

const npmRunRe = /npm run ([A-Za-z0-9:_-]+)/g;
const tierEnvRe = /QA_(?:ULTIMATE_TIER|SWEEP_TIER)=([A-Za-z0-9_]+)/g;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replace(/\\/g, "/");
  for (const m of text.matchAll(npmRunRe)) {
    const name = m[1];
    if (!(name in scripts)) missing.push({ file: rel, missingCommand: name });
  }
  if (strict) {
    for (const m of text.matchAll(tierEnvRe)) {
      const t = m[1];
      if (!knownTiers.has(t)) badTierRefs.push({ file: rel, tier: t });
    }
  }
}

const payload = {
  checkId: "workflow-tier-coverage",
  ok: missing.length === 0 && badTierRefs.length === 0,
  missingCount: missing.length,
  badTierRefsCount: badTierRefs.length,
  missing: missing.slice(0, 50),
  badTierRefs: badTierRefs.slice(0, 50),
};

console.log(JSON.stringify(payload, null, 2));

if (missing.length || (strict && badTierRefs.length)) {
  if (missing.length) console.error("ERROR: workflows reference npm scripts missing from package.json.");
  if (strict && badTierRefs.length) console.error("ERROR: workflows use unknown QA_*_TIER id.");
  process.exit(1);
}
process.exit(0);
