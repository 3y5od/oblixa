#!/usr/bin/env node
/**
 * Ensures scripts/refinement-acceptance-checklist.txt still references key automation commands.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const checklistPath = path.join(root, "scripts", "refinement-acceptance-checklist.txt");

const REQUIRED_SUBSTRINGS = [
  "npm run audit:core-terminology:strict",
  "npm run audit:marketing-identity:strict",
  "npm run audit:ui-operational:strict",
  "npm run check:v7-suite",
  "npm run test:e2e",
  "e2e/refinement-optional-fixtures.spec.ts",
  "e2e/authenticated.spec.ts",
];

function main() {
  if (!fs.existsSync(checklistPath)) {
    console.error("Missing", checklistPath);
    process.exit(1);
  }
  const text = fs.readFileSync(checklistPath, "utf8");
  const missing = REQUIRED_SUBSTRINGS.filter((s) => !text.includes(s));
  if (missing.length) {
    console.error("check-refinement-acceptance-commands: missing required substrings:");
    for (const s of missing) console.error(" ", s);
    process.exit(1);
  }
  console.log("check-refinement-acceptance-commands: OK");
}

main();
