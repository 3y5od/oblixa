#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".ipynb")) acc.push(p);
  }
  return acc;
}

const strict = process.env.CI_INGEST_NOTEBOOKS === "1";
const nb = walk(root);
if (nb.length && !strict) {
  console.warn(`WARN: ${nb.length} .ipynb file(s) present — set CI_INGEST_NOTEBOOKS=1 only if CI executes them.`);
}
console.log("OK: notebook execution guard.");
