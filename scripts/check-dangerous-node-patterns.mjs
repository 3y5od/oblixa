#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
/** Regex / audit sources legitimately mention banned tokens as patterns. */
const EXEMPT_REL = new Set(["scripts/security-static-audit.mjs", "scripts/check-dangerous-node-patterns.mjs"]);
const BAD = [
  { re: /\beval\s*\(/g, id: "eval" },
  { re: /\bnew\s+Function\s*\(/g, id: "new_function" },
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|mjs|cjs|js)$/.test(name)) acc.push(p);
  }
  return acc;
}

const dirs = [path.join(ROOT, "src"), path.join(ROOT, "scripts")].flatMap((d) => walk(d));
const hits = [];
for (const file of dirs) {
  const rel = path.relative(ROOT, file);
  if (rel.includes("node_modules") || EXEMPT_REL.has(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const { re, id } of BAD) {
    re.lastIndex = 0;
    if (re.test(text)) hits.push({ file: rel, pattern: id });
  }
}

const strict = process.argv.includes("--strict");
const ok = hits.length === 0 || !strict;
console.log(JSON.stringify({ ok, hits: hits.slice(0, 30), totalHits: hits.length, strict }, null, 2));
process.exit(ok ? 0 : 1);
