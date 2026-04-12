#!/usr/bin/env node
/**
 * Ensures scripts/qa-loading-routes-checklist.txt references existing loading.tsx files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const checklistPath = path.join(root, "scripts", "qa-loading-routes-checklist.txt");

function main() {
  if (!fs.existsSync(checklistPath)) {
    console.error("Missing", checklistPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(checklistPath, "utf8");
  const lines = raw.split("\n");
  const missing = [];
  let checked = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      console.warn("SKIP (need route + path):", line);
      continue;
    }
    const rel = parts[parts.length - 1];
    if (!rel.startsWith("src/")) {
      console.warn("SKIP (expected src/ path):", line);
      continue;
    }
    const abs = path.join(root, rel);
    checked += 1;
    if (!fs.existsSync(abs)) missing.push({ rel, line: t });
  }
  if (missing.length) {
    console.error("check-qa-loading-routes: missing files:");
    for (const m of missing) console.error(" ", m.rel, "<-", m.line);
    process.exit(1);
  }
  console.log(`check-qa-loading-routes: OK (${checked} path(s))`);
}

main();
