#!/usr/bin/env node
/**
 * Phase 0b: outbound fetch inventory — raw fetch( outside safeFetch must be
 * listed in scripts/security-fetch-sink-baseline.txt or carry an inline
 * // security:fetch-allowlist SEC-xxx waiver on the same line.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcRoot = path.join(root, "src");
const baselinePath = path.join(__dirname, "security-fetch-sink-baseline.txt");
const strict = process.argv.includes("--strict");

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) return new Set();
  return new Set(
    fs
      .readFileSync(baselinePath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  );
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.(test|spec)\./.test(name)) acc.push(p);
  }
  return acc;
}

function main() {
  const baseline = loadBaseline();
  const violations = [];
  for (const abs of walk(srcRoot)) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const text = fs.readFileSync(abs, "utf8");
    if (!/\bfetch\s*\(/.test(text)) continue;
    if (rel === "src/lib/security/safe-fetch.ts") continue;

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/\bfetch\s*\(/.test(line)) continue;
      if (/safeFetch\b/.test(line)) continue;
      if (/security:fetch-allowlist\b/.test(line)) continue;
      if (baseline.has(rel)) continue;
      violations.push(`${rel}:${i + 1}: raw fetch(`);
    }
  }

  if (violations.length) {
    console.error(
      "check-security-fetch-sinks: raw fetch( outside safeFetch / baseline / inline waiver:\n" +
        violations.map((v) => `  ${v}`).join("\n")
    );
    if (strict) process.exit(1);
    console.warn("(non-strict: exit 0; use --strict in CI when ready)");
  } else {
    console.log("check-security-fetch-sinks: OK");
  }
}

main();
