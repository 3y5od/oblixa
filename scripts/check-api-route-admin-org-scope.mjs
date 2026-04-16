#!/usr/bin/env node
/**
 * Fails when an API route uses createAdminClient without obvious org-scope guard signals.
 * This is heuristic, intentionally conservative, and supports an allowlist escape hatch.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "api-route-admin-org-scope-allowlist.txt");
const reportOnly = process.argv.includes("--report");

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

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) return new Set();
  const set = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    set.add(t.replace(/\\/g, "/"));
  }
  return set;
}

const SCOPE_SIGNALS = [
  /organization_id/,
  /\borgId\b/,
  /\bgetApiAuthContext\b/,
  /\bgetDeterministicMembership\b/,
  /\.eq\(\s*["']organization_id["']/,
  /\.match\(\s*\{[^}]*organization_id/,
  /\brequireV5ApiFeature\b|\brequireV6ApiFeature\b/,
  /\[token\]/,
  /\brequireV5CronAuth\b|\brequireV6CronAuth\b|\bauthorizeCronRequest\b|\bensureCronAuthorized\b/,
];

const routes = walkRoutes(apiRoot).sort();
const allowlist = loadAllowlist();
const violations = [];

for (const abs of routes) {
  const rel = toApiRelative(abs);
  if (allowlist.has(rel)) continue;
  const text = fs.readFileSync(abs, "utf8");
  if (!/\bcreateAdminClient\b/.test(text)) continue;
  const hasScopeSignal = rel.includes("[token]") || SCOPE_SIGNALS.some((re) => re.test(text));
  if (!hasScopeSignal) violations.push(rel);
}

const payload = {
  totalRoutes: routes.length,
  violationCount: violations.length,
  violations,
};
console.log(JSON.stringify(payload, null, 2));

if (reportOnly) process.exit(0);
if (violations.length > 0) {
  console.error(
    "API route(s) reference createAdminClient without org-scope guard signals (or allowlist):\n"
  );
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    "\nAdd explicit org-scope guards or add route to scripts/api-route-admin-org-scope-allowlist.txt with justification."
  );
  process.exit(1);
}
console.log(`OK: ${routes.length} API route(s) satisfy admin org-scope checks.`);
