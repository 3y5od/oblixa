#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

function toRepoPath(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function shouldSkipRel(rel) {
  return rel.includes("node_modules") || EXEMPT_REL.has(rel) || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(rel);
}

export function analyzeDangerousNodePatterns(root = ROOT, options = {}) {
  const dirs = [path.join(root, "src"), path.join(root, "scripts")].flatMap((d) => walk(d));
  const hits = [];
  for (const file of dirs) {
    const rel = toRepoPath(root, file);
    if (shouldSkipRel(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const { re, id } of BAD) {
      re.lastIndex = 0;
      if (re.test(text)) hits.push({ file: rel, pattern: id });
    }
  }
  const strict = options.strict ?? false;
  return { ok: hits.length === 0 || !strict, hits: hits.slice(0, 30), totalHits: hits.length, strict };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeDangerousNodePatterns(ROOT, { strict: process.argv.includes("--strict") });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
