#!/usr/bin/env node
/**
 * Fails if git tracks obvious secret material or coverage HTML trees.
 */
import { execSync } from "node:child_process";
import process from "node:process";

let tracked;
try {
  tracked = execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
} catch {
  console.error("git ls-files failed (not a git repo?)");
  process.exit(1);
}

const violations = [];
for (const f of tracked) {
  const base = f.split("/").pop() ?? f;
  if (base.startsWith(".env") && base !== ".env.example") {
    violations.push(f);
  }
  if (/\.(pem|p12)$/i.test(f)) {
    violations.push(f);
  }
  if (f.startsWith("coverage/") || f === "coverage") {
    violations.push(f);
  }
}

if (violations.length > 0) {
  console.error("Tracked file(s) look like secrets or coverage output:\n");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`OK: ${tracked.length} tracked file(s) pass secrets/coverage hygiene check.`);
