#!/usr/bin/env node
/**
 * Fails when a new src/lib file references createAdminClient outside
 * scripts/server-lib-admin-allowlist.txt (review IDOR / tenancy at call sites).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const libRoot = path.join(root, "src", "lib");
const allowlistPath = path.join(__dirname, "server-lib-admin-allowlist.txt");

function walkLibTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkLibTs(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function loadAllowlist() {
  const set = new Set();
  if (!fs.existsSync(allowlistPath)) return set;
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) set.add(t.replace(/\\/g, "/"));
  }
  return set;
}

const allow = loadAllowlist();
const files = walkLibTs(libRoot).sort();
const hits = [];
for (const abs of files) {
  const content = fs.readFileSync(abs, "utf8");
  if (!/\bcreateAdminClient\b/.test(content)) continue;
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  hits.push(rel);
}

if (process.argv.includes("--print-hits")) {
  for (const h of hits) console.log(h);
  process.exit(0);
}

const violations = hits.filter((h) => !allow.has(h));
if (violations.length > 0) {
  console.error("src/lib file(s) reference createAdminClient but are not allowlisted:\n");
  for (const v of violations) console.error(`  - ${v}`);
  console.error("\nAdd each path to scripts/server-lib-admin-allowlist.txt after security review.");
  process.exit(1);
}

console.log(`OK: ${hits.length} library file(s) with createAdminClient are allowlisted.`);
