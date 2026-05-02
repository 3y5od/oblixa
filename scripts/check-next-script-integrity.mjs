#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walk(p, acc);
    } else if (/\.(tsx|jsx)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

function main() {
  const hits = [];
  for (const f of walk(path.join(root, "src"))) {
    const raw = fs.readFileSync(f, "utf8");
    if (!raw.includes("next/script") && !raw.includes('from "next/script"') && !raw.includes("from 'next/script'")) continue;
    if (/<Script[\s\S]*?\bsrc=/.test(raw) && !/<Script[\s\S]*?\bintegrity=/.test(raw)) {
      hits.push(path.relative(root, f));
    }
  }
  if (hits.length) {
    console.error("next/script with src= but no integrity=:\n" + hits.join("\n"));
    process.exit(1);
  }
  console.log("OK: next/script SRI spot-check.");
}

main();
