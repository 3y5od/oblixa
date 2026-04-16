#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

function loadGeneratedArray(filePath) {
  const source = readFileSync(filePath, "utf8");
  const match = source.match(/=\s*(\[[\s\S]*\])\s+as const;/);
  if (!match) {
    throw new Error(`Could not parse generated matrix: ${filePath}`);
  }
  return JSON.parse(match[1]);
}

const generated = loadGeneratedArray(
  path.join(process.cwd(), "e2e", "generated", "authenticated-routes.ts")
);
const all = generated
  .filter((entry) => Array.isArray(entry.coverage) && entry.coverage.includes("a11y"))
  .map((entry) => entry.visitPath);
const seen = new Set();
const duplicates = [];
for (const p of all) {
  if (seen.has(p)) duplicates.push(p);
  seen.add(p);
}

const missingCritical = ["/dashboard", "/contracts", "/settings"].filter((p) => !seen.has(p));
console.log(
  JSON.stringify(
    {
      totalPathCount: all.length,
      uniquePathCount: seen.size,
      duplicateCount: duplicates.length,
      duplicates,
      missingCriticalCount: missingCritical.length,
      missingCritical,
    },
    null,
    2
  )
);

if (missingCritical.length > 0) {
  process.exit(1);
}
