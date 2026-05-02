#!/usr/bin/env node
/**
 * Ensures every package.json `check:*` script is either listed in qa-tier-manifest tier steps
 * or explicitly allowlisted (e.g. covered via checks_batch autodiscover / pipelines).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "config", "qa-tier-manifest.json"), "utf8"));

const allowPath = path.join(root, "config", "qa-tier-coverage-allowlist.json");
const allowData = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, "utf8")) : { scripts: [] };
const allow = new Set(Array.isArray(allowData.scripts) ? allowData.scripts : []);

const checks = Object.keys(pkg.scripts || {}).filter((k) => k.startsWith("check:"));

const inManifest = new Set();
for (const tier of Object.values(manifest.tiers || {})) {
  for (const step of tier.steps || []) {
    if (typeof step === "string") inManifest.add(step);
    else if (step && typeof step.script === "string") inManifest.add(step.script);
  }
}

const uncovered = checks.filter((c) => !inManifest.has(c) && !allow.has(c)).sort();
const orphanAllow = [...allow].filter((s) => !checks.includes(s) && s.startsWith("check:")).sort();

const payload = {
  checkId: "tier-coverage",
  ok: uncovered.length === 0 && orphanAllow.length === 0,
  counts: {
    checkScripts: checks.length,
    manifestScripts: inManifest.size,
    allowlist: allow.size,
    uncovered: uncovered.length,
    orphanAllowlist: orphanAllow.length,
  },
  uncovered: uncovered.slice(0, 80),
  uncoveredTruncated: uncovered.length > 80,
  orphanAllowlist: orphanAllow.slice(0, 40),
};

console.log(JSON.stringify(payload, null, 2));

if (strict && uncovered.length) {
  console.error("ERROR: check:* scripts not in manifest and not allowlisted.");
  process.exit(1);
}
if (strict && orphanAllow.length) {
  console.error("ERROR: allowlist references unknown check:* scripts.");
  process.exit(1);
}
process.exit(0);
