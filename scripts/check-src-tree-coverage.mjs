#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const strict = process.env.SRC_TREE_STRICT === "1" || process.env.SRC_TREE_STRICT === "true";
const src = path.join(process.cwd(), "src");

function* walkFiles(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles(p);
    else yield p;
  }
}

const top = fs.readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory());
const allowEmpty = new Set(["types", "styles", "app", "middleware"]);
const report = [];
for (const ent of top) {
  const base = path.join(src, ent.name);
  let count = 0;
  for (const f of walkFiles(base)) {
    if (/\.(test|spec)\.(tsx?|mts?)$/.test(f)) count++;
  }
  report.push({ dir: ent.name, testFileCount: count });
}

const zero = report.filter((r) => r.testFileCount === 0 && !allowEmpty.has(r.dir));
const ok = !strict || zero.length === 0;
console.log(JSON.stringify({ ok, strict, zeroDirs: zero.map((z) => z.dir), sample: report.slice(0, 12) }, null, 2));
process.exit(ok ? 0 : 1);
