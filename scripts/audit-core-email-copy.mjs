#!/usr/bin/env node
/**
 * docs/refinement.md §2 / §11 — Core email helpers should not hard-code Advanced/Assurance lemmas
 * in static subject/body (dynamic user content is degraded via email-workspace-degrade).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const strict = process.argv.includes("--strict");

const FORBIDDEN = [
  /\bscorecard\b/i,
  /\bplaybook\b/i,
  /\bautopilot\b/i,
  /\bfinding\b/i,
  /\bsegment\b/i,
  /outcome\s+intelligence/i,
  /program\s+evolution/i,
  /control\s+policy/i,
  /health\s+graph/i,
];

const files = [
  join(process.cwd(), "src", "lib", "email.ts"),
  join(process.cwd(), "src", "lib", "email-workspace-degrade.ts"),
];

function stripPhraseBlock(src) {
  return src.replace(/const PHRASE_REPLACEMENTS:[\s\S]*?\];/, "");
}

const hits = [];
for (const file of files) {
  let raw = readFileSync(file, "utf8");
  if (file.endsWith("email-workspace-degrade.ts")) {
    raw = stripPhraseBlock(raw);
  }
  const body = raw
    .split("\n")
    .filter((line) => !/^\s*import\s/.test(line))
    .join("\n");
  for (const re of FORBIDDEN) {
    if (re.test(body)) {
      hits.push({ file, pattern: re.toString() });
    }
  }
}

if (hits.length) {
  console.error("Core email copy audit: potential contained-module lemmas in static templates\n");
  for (const h of hits) {
    console.error(`  ${h.file}\n    matched ${h.pattern}\n`);
  }
  if (strict) process.exit(1);
} else {
  console.log("Core email copy audit: no forbidden lemmas in scoped email helpers.");
}
