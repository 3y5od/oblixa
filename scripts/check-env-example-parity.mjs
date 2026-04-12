#!/usr/bin/env node
/**
 * Requires process.env.KEY references under src/ to appear in .env.example (names only),
 * except keys listed in scripts/env-example-parity-allowlist.txt.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envExample = path.join(root, ".env.example");
const srcRoot = path.join(root, "src");
const allowlistPath = path.join(__dirname, "env-example-parity-allowlist.txt");

function loadAllowlist() {
  const s = new Set();
  if (fs.existsSync(allowlistPath)) {
    for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
      const t = line.trim();
      if (t && !t.startsWith("#")) s.add(t);
    }
  }
  return s;
}

function loadEnvExampleKeys() {
  const raw = fs.readFileSync(envExample, "utf8");
  const keys = new Set();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    const m = /^([A-Z][A-Z0-9_]*)\s*=/.exec(t);
    if (m) keys.add(m[1]);
    const mComment = /^#\s*([A-Z][A-Z0-9_]*)\s*=/.exec(t);
    if (mComment) keys.add(mComment[1]);
    const mBare = /^#\s*([A-Z][A-Z0-9_]*)\s*$/.exec(t);
    if (mBare) keys.add(mBare[1]);
  }
  return keys;
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

const allow = loadAllowlist();
const documented = loadEnvExampleKeys();
const envRe = /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g;
const used = new Set();

for (const file of walkFiles(srcRoot)) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  while ((m = envRe.exec(text)) !== null) {
    used.add(m[1]);
  }
}

const missing = [...used]
  .filter((k) => !documented.has(k) && !allow.has(k))
  .sort();

if (missing.length > 0) {
  console.error("process.env key(s) used in src/ but not documented in .env.example:\n");
  for (const k of missing) console.error(`  - ${k}`);
  console.error("\nAdd each to .env.example (or env-example-parity-allowlist.txt if intentionally undocumented).");
  process.exit(1);
}

console.log(`OK: ${used.size} distinct process.env key(s) in src/ are documented or allowlisted.`);
