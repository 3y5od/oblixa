#!/usr/bin/env node
/**
 * Writes config/qa-maximal-sweep-track-registry.json — one row per plan track (p0–p210).
 * Evidence is expressed as npm script names that must exist in package.json (CI closure).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = pkg.scripts || {};

const ROTATING = [
  "check:api-route-tests",
  "check:openapi-route-coverage",
  "check:artifact-json-matrix",
  "check:security-enforcement-matrix:strict",
  "check:e2e-quarantine:strict",
  "check:github-workflows-security",
  "check:dependency-policy",
  "check:lockfile-integrity-drift",
  "report:qa-coverage-tier",
  "check:tier-coverage:strict",
  "check:workflow-tier-coverage:strict",
  "check:qa-maximal-bundle",
  "check:qa-waiver-registry",
  "check:command-reference-integrity",
  "check:cron-route-auth",
  "check:server-action-exports",
  "check:server-action-auth-contract",
  "check:api-route-auth-contract",
  "check:api-route-rate-limit-coverage",
];

function uniq(arr) {
  return [...new Set(arr)];
}

function npmForP0toP11(n) {
  const map = {
    0: ["qa:baseline:capture", "report:qa-coverage-tier"],
    1: ["qa:sweep:max:p10", "check:qa-maximal-bundle"],
    2: ["check:github-actions-permissions", "check:workflow-tier-coverage:strict"],
    3: ["check:tier-coverage:strict", "qa:cost:estimate"],
    4: ["check:playwright-tag-coverage", "test:e2e:smoke"],
    5: ["test:logic:coverage", "check:checks-integrity-meta"],
    6: ["check:migration-security-patterns", "test:rls-smoke"],
    7: ["check:vercel-cron", "test:k6:smoke"],
    8: ["check:qa-maximal-bundle", "check:sbom-formats-vex-sarif"],
    9: ["check:artifact-json-matrix", "check:pen-test-findings-closure"],
    10: ["check:qa-maximal-bundle", "security:audit:maximal"],
    11: ["qa:sweep:universe", "write:qa-universe-attestation"],
  };
  return map[n] ?? ["check:command-reference-integrity"];
}

function npmForTrack(n) {
  if (n <= 11) return npmForP0toP11(n);
  if (n === 12) return ["check:api-route-tests", "check:openapi-route-coverage"];
  if (n === 13) return ["check:server-action-exports", "check:server-action-auth-contract"];
  if (n === 14) return ["check:cron-route-auth", "check:vercel-cron"];
  if (n === 210) {
    return uniq([
      "write:qa-universe-attestation",
      "check:qa-maximal-sweep-track-registry",
      "check:command-reference-integrity",
    ]);
  }
  const a = ROTATING[n % ROTATING.length];
  const b = ROTATING[(n + 5) % ROTATING.length];
  const c = ROTATING[(n + 11) % ROTATING.length];
  return uniq([a, b, c, "check:command-reference-integrity"]);
}

const tracks = {};
for (let i = 0; i <= 210; i += 1) {
  const id = `p${i}`;
  const npm = npmForTrack(i);
  for (const s of npm) {
    if (!(s in scripts)) {
      console.error(JSON.stringify({ ok: false, reason: "unknown_npm_script", track: id, script: s }, null, 2));
      process.exit(1);
    }
  }
  tracks[id] = {
    npm,
    note:
      i === 210
        ? "P210 attestation artifact + track-registry integrity"
        : i <= 14
          ? "Macro-phase evidence"
          : "Rotating maximal QA script bundle (plan P15+)",
  };
}

const out = {
  version: 1,
  generatedAt: new Date().toISOString(),
  tracks,
};

const dest = path.join(root, "config", "qa-maximal-sweep-track-registry.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, wrote: path.relative(root, dest), trackCount: Object.keys(tracks).length }, null, 2));
