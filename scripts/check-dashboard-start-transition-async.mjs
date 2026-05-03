#!/usr/bin/env node
/**
 * Epic 4 — Fail when dashboard client modules pass an async function directly to startTransition.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dashboardRoot = path.join(root, "src", "app", "(dashboard)");
const badRe = /startTransition\s*\(\s*async\s*\(/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

const hits = [];
for (const file of walk(dashboardRoot)) {
  const text = fs.readFileSync(file, "utf8");
  if (badRe.test(text)) {
    hits.push(path.relative(root, file));
  }
}

if (hits.length) {
  console.error("startTransition(async …) is not allowed in dashboard client modules:");
  for (const h of hits) console.error(`  - ${h}`);
  console.error("Use startTransition(() => { void (async () => { … })(); }); instead.");
  process.exit(1);
}

console.log("OK: no async startTransition callbacks under src/app/(dashboard).");
