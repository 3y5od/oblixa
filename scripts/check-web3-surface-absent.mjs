#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const needles = ["ethers", "viem", "wagmi", "@web3-react", "solana/web3.js"];
const hits = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (n === "node_modules" || n === ".next") continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs)$/.test(n)) {
      const t = fs.readFileSync(p, "utf8");
      for (const nd of needles) {
        if (t.includes(nd)) hits.push({ file: path.relative(ROOT, p), needle: nd });
      }
    }
  }
}
walk(path.join(ROOT, "src"));
const manifest = path.join(ROOT, "artifacts", "web3-surface-absent.json");
const absent = { web3LibrariesDetected: hits.length === 0, hits: hits.slice(0, 20) };
fs.mkdirSync(path.dirname(manifest), { recursive: true });
fs.writeFileSync(manifest, `${JSON.stringify(absent, null, 2)}\n`);
console.log(JSON.stringify(absent, null, 2));
process.exit(hits.length ? 1 : 0);
