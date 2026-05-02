#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const hits = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (n === "node_modules" || n === ".next") continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(n)) {
      const t = fs.readFileSync(p, "utf8");
      if (/\bWebAssembly\.instantiate\b/.test(t)) hits.push(path.relative(ROOT, p));
      if (/\bnew\s+Worker\s*\(/.test(t)) hits.push(path.relative(ROOT, p));
    }
  }
}
walk(path.join(ROOT, "src"));
const nextCfg = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
const unsafe = /unsafe-inline/.test(nextCfg);
console.log(JSON.stringify({ ok: true, wasmWorkerHits: hits.slice(0, 20), nextConfigUnsafeInline: unsafe }, null, 2));
process.exit(0);
