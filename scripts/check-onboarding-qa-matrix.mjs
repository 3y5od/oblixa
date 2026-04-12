#!/usr/bin/env node
/**
 * Validates scripts/onboarding-qa-matrix.json entries exist on disk.
 * Optional: --strict also requires every src/lib/onboarding .test.ts file to appear in the matrix.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const matrixPath = path.join(__dirname, "onboarding-qa-matrix.json");

function walkTestFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkTestFiles(p, acc);
    else if (name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

function main() {
  const raw = fs.readFileSync(matrixPath, "utf8");
  const data = JSON.parse(raw);
  const files = data.testFiles;
  if (!Array.isArray(files) || files.length === 0) {
    console.error("FAIL onboarding-qa-matrix.json missing testFiles array");
    process.exit(1);
  }
  for (const rel of files) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      console.error(`FAIL missing test file: ${rel}`);
      process.exit(1);
    }
  }
  console.log(`PASS onboarding QA matrix (${files.length} test files exist)`);

  const strict = process.argv.includes("--strict");
  if (strict) {
    const libOnboarding = path.join(root, "src/lib/onboarding");
    const discovered = walkTestFiles(libOnboarding).map((p) => path.relative(root, p).split(path.sep).join("/"));
    const set = new Set(files);
    const missing = discovered.filter((f) => !set.has(f));
    if (missing.length) {
      console.error("FAIL strict: lib/onboarding test files not listed in matrix:", missing.join(", "));
      process.exit(1);
    }
    console.log("PASS strict: all src/lib/onboarding/*.test.ts listed");
  }
}

main();
