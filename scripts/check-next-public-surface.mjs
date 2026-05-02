#!/usr/bin/env node
/**
 * Complements instrumentation: fail CI if suspicious NEXT_PUBLIC_* appears in tracked env samples.
 * Loads .env.example keys only (no secret values).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envExample = path.join(__dirname, "..", ".env.example");
const raw = fs.readFileSync(envExample, "utf8");
const bad = [];
for (const line of raw.split("\n")) {
  const m = /^(NEXT_PUBLIC_[A-Z0-9_]+)=/i.exec(line.trim());
  if (!m) continue;
  if (/SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY/i.test(m[1])) bad.push(m[1]);
}
if (bad.length) {
  console.error("Suspicious NEXT_PUBLIC_* keys in .env.example:", bad.join(", "));
  process.exit(1);
}
console.log("OK: NEXT_PUBLIC surface in .env.example.");
