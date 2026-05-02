#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const srcLib = path.join(ROOT, "src", "lib");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(n) && !/\.(test|spec)\./.test(n)) acc.push(p);
  }
  return acc;
}

const prodFiles = walk(srcLib);
const heatmap = [];
for (const abs of prodFiles.slice(0, 400)) {
  const rel = path.relative(ROOT, abs);
  const lines = fs.readFileSync(abs, "utf8").split("\n").length;
  const testSibling =
    fs.existsSync(abs.replace(/\.tsx?$/, ".test.ts")) ||
    fs.existsSync(abs.replace(/\.tsx?$/, ".test.tsx"));
  heatmap.push({ file: rel, prodLines: lines, hasColocatedTest: testSibling });
}

const out = {
  generatedAt: new Date().toISOString(),
  sampleSize: heatmap.length,
  rows: heatmap.filter((r) => !r.hasColocatedTest).slice(0, 80),
};
fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "artifacts", "test-heatmap.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, artifact: "artifacts/test-heatmap.json", uncoveredCount: out.rows.length }, null, 2));
process.exit(0);
