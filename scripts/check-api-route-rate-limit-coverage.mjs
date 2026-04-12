#!/usr/bin/env node
/**
 * Fails when an API route.ts uses createAdminClient without rateLimitCheck,
 * unless listed in scripts/api-route-rate-limit-allowlist.txt (paths relative to src/app/api).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "api-route-rate-limit-allowlist.txt");

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
  if (!fs.existsSync(allowlistPath)) return new Set();
  const set = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    set.add(t.replace(/\\/g, "/"));
  }
  return set;
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

const routes = walkRoutes(apiRoot).sort();
const allowlist = loadAllowlist();
const violations = [];

for (const abs of routes) {
  const rel = toApiRelative(abs);
  if (allowlist.has(rel)) continue;
  const text = fs.readFileSync(abs, "utf8");
  if (!/\bcreateAdminClient\b/.test(text)) continue;
  if (/\brateLimitCheck\b/.test(text)) continue;
  violations.push(rel);
}

if (violations.length > 0) {
  console.error(
    "API route(s) use createAdminClient without rateLimitCheck and are not allowlisted:\n"
  );
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    "\nAdd rateLimitCheck (after auth) or list the path in scripts/api-route-rate-limit-allowlist.txt with a short comment line above it."
  );
  process.exit(1);
}

console.log(`OK: ${routes.length} API route(s) satisfy rate-limit coverage (or allowlist).`);
