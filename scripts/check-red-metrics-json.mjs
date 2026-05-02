#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const allowPath = path.join(ROOT, "artifacts", "red-metrics-allowlist.json");
const allow = JSON.parse(fs.readFileSync(allowPath, "utf8"));
const names = new Set(allow.metricNames || []);
const wildcard = names.has("*");
const srcRoot = path.join(ROOT, "src");
const found = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (n === "node_modules" || n === ".next") continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(n)) {
      const t = fs.readFileSync(p, "utf8");
      for (const m of t.matchAll(/\bmetrics\.([a-zA-Z0-9_]+)\b/g)) found.push(m[1]);
    }
  }
}
walk(srcRoot);
const unknown = wildcard ? [] : [...new Set(found)].filter((n) => !names.has(n));
const strict = process.argv.includes("--strict");
const ok = !strict || unknown.length === 0;
const payload = { ok, unknownSample: unknown.slice(0, 20), allowlistSize: names.size, wildcard };
fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "artifacts", "red-metrics-scan.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(ok ? 0 : 1);
