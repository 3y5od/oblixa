#!/usr/bin/env node
/**
 * docs/refinement.md §19 — refinement-critical API trees must follow the same test/allowlist
 * discipline as `check-api-route-tests.mjs` (assurance, autopilot, selected outbound crons).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "api-route-test-allowlist.txt");

const PREFIXES = ["assurance/", "autopilot/"];

/** Cron routes that emit or schedule tier-sensitive notifications (§18). */
const CRON_REL_PATHS = [
  "cron/v4/report-packs-generate/route.ts",
  "reports/send-summaries/route.ts",
  "reminders/send/route.ts",
];

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function loadAllowlist() {
  const raw = fs.readFileSync(allowlistPath, "utf8");
  const set = new Set();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    set.add(t.replace(/\\/g, "/"));
  }
  return set;
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

const allowlist = loadAllowlist();
const allRoutes = walkRoutes(apiRoot).sort();
const violations = [];

for (const abs of allRoutes) {
  const rel = toApiRelative(abs);
  const inScope = PREFIXES.some((pre) => rel.startsWith(pre));
  if (!inScope) continue;
  const dir = path.dirname(abs);
  const colocated = path.join(dir, "route.test.ts");
  if (fs.existsSync(colocated)) continue;
  if (allowlist.has(rel)) continue;
  violations.push(rel);
}

for (const rel of CRON_REL_PATHS) {
  const abs = path.join(apiRoot, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(abs)) {
    violations.push(`(missing file) ${rel}`);
    continue;
  }
  const dir = path.dirname(abs);
  const colocated = path.join(dir, "route.test.ts");
  if (fs.existsSync(colocated)) continue;
  if (allowlist.has(rel)) continue;
  violations.push(rel);
}

if (violations.length > 0) {
  console.error(
    "Refinement-critical API route(s) missing colocated route.test.ts and not allowlisted:\n"
  );
  for (const v of violations) console.error(`  - ${v}`);
  console.error("\nAdd a colocated test or an entry in scripts/api-route-test-allowlist.txt.");
  process.exit(1);
}

const scoped = allRoutes.filter((abs) => PREFIXES.some((pre) => toApiRelative(abs).startsWith(pre)));
console.log(
  `OK: refinement API coverage — ${scoped.length} route(s) under assurance/ + autopilot/, ${CRON_REL_PATHS.length} watched cron(s).`
);
