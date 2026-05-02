#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAN_RE = /\b4\d{15}\b/;
const scanDirs = [path.join(ROOT, "src")];
const hits = [];
for (const dir of scanDirs) {
  if (!fs.existsSync(dir)) continue;
  const walk = (d) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (n === "node_modules" || n === ".next") continue;
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(n)) {
        const t = fs.readFileSync(p, "utf8");
        if (PAN_RE.test(t)) hits.push(path.relative(ROOT, p));
      }
    }
  };
  walk(dir);
}
console.log(JSON.stringify({ ok: hits.length === 0, panLikeHits: hits.slice(0, 20) }, null, 2));
process.exit(hits.length ? 1 : 0);
