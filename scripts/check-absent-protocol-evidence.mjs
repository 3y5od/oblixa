#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "artifacts/web3-surface-absent.json",
  "artifacts/graphql-surface-absent.json",
  "artifacts/sar-surface-absent.json",
];
const bad = [];
for (const rel of files) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    bad.push({ rel, reason: "missing" });
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    bad.push({ rel, reason: String(e?.message || e) });
  }
}
const ok = bad.length === 0;
console.log(JSON.stringify({ ok, bad }, null, 2));
process.exit(ok ? 0 : 1);
