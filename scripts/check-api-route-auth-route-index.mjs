#!/usr/bin/env node
/**
 * Ensures scripts/api-route-auth-route-index.txt matches every src/app/api route.ts
 * (sorted, one relative path per line). Regenerate with npm run sync:api-route-auth-route-index.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const indexPath = path.join(__dirname, "api-route-auth-route-index.txt");

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(path.relative(apiRoot, p).replace(/\\/g, "/"));
  }
  return acc;
}

function loadExpectedLines() {
  if (!fs.existsSync(indexPath)) {
    console.error(`Missing ${path.relative(root, indexPath)} — run npm run sync:api-route-auth-route-index`);
    process.exit(1);
  }
  const raw = fs.readFileSync(indexPath, "utf8");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

const disk = walkRoutes(apiRoot).sort();
const file = loadExpectedLines().sort();

const missingOnDisk = file.filter((r) => !disk.includes(r));
const missingInFile = disk.filter((r) => !file.includes(r));

if (missingOnDisk.length || missingInFile.length) {
  console.error("api-route-auth-route-index.txt is out of sync with src/app/api.");
  if (missingOnDisk.length) {
    console.error("\nStale entries (in index but no route.ts):");
    for (const r of missingOnDisk) console.error(`  - ${r}`);
  }
  if (missingInFile.length) {
    console.error("\nMissing entries (route.ts not listed in index):");
    for (const r of missingInFile) console.error(`  - ${r}`);
  }
  console.error("\nRun: npm run sync:api-route-auth-route-index");
  process.exit(1);
}

if (file.length !== disk.length) {
  console.error("Line count mismatch (unexpected).");
  process.exit(1);
}

console.log(`OK: ${disk.length} API route path(s) match api-route-auth-route-index.txt.`);
