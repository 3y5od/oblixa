#!/usr/bin/env node
// Ensures every API route.ts has colocated route.test.ts or scripts/api-route-test-allowlist.txt.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "api-route-test-allowlist.txt");

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

const routes = walkRoutes(apiRoot).sort();
const allowlist = loadAllowlist();
const violations = [];

for (const abs of routes) {
  const rel = toApiRelative(abs);
  const dir = path.dirname(abs);
  const colocated = path.join(dir, "route.test.ts");
  if (fs.existsSync(colocated)) continue;
  if (allowlist.has(rel)) continue;
  violations.push(rel);
}

if (violations.length > 0) {
  console.error(
    "API route(s) missing colocated route.test.ts and not in scripts/api-route-test-allowlist.txt:\n"
  );
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    "\nAdd a colocated test, or list the path in the allowlist with a comment documenting bundle coverage."
  );
  process.exit(1);
}

console.log(`OK: ${routes.length} API route(s) have tests or allowlist entries.`);
