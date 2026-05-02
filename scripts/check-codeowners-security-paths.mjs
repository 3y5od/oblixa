#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const co = path.join(__dirname, "..", ".github", "CODEOWNERS");
if (!fs.existsSync(co)) {
  console.error("missing .github/CODEOWNERS");
  process.exit(1);
}
const raw = fs.readFileSync(co, "utf8");
const required = ["src/app/api/", "supabase/migrations/", ".github/workflows/"];
const missing = required.filter((p) => !raw.includes(p));
if (missing.length) {
  console.warn(`WARN: CODEOWNERS may be missing patterns: ${missing.join(", ")}`);
}
console.log("OK: CODEOWNERS security path spot-check.");
