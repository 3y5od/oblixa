#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src");

const BAD = [/from\s+["']vm["']/, /\bnode:vm\b/, /deserialize\(/, /serialize-javascript/];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

const violations = [];
for (const f of walk(root)) {
  const raw = fs.readFileSync(f, "utf8");
  for (const re of BAD) {
    if (re.test(raw)) violations.push(`${f}: ${re}`);
  }
}
if (violations.length) {
  console.error(JSON.stringify({ ok: false, violations }, null, 2));
  process.exit(1);
}
console.log("OK: no obvious unsafe deserialization imports in src/.");
