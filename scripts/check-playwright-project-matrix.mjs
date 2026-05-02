#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const matrixPath = path.join(ROOT, "artifacts", "browser-os-matrix.json");
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
const expected = new Set((matrix.projects || []).map((p) => p.name));
const cfg = fs.readFileSync(path.join(ROOT, "playwright.config.ts"), "utf8");
const found = new Set();
for (const m of cfg.matchAll(/\{\s*name:\s*"([^"]+)"/g)) found.add(m[1]);
const missing = [...expected].filter((n) => !found.has(n));
const extra = [...found].filter((n) => !expected.has(n) && !["Mobile Chrome", "iPad"].includes(n));
const strict = process.argv.includes("--strict");
const ok = !strict || (missing.length === 0 && extra.length === 0);
console.log(JSON.stringify({ ok, expected: [...expected], found: [...found], missing, extraNote: extra }, null, 2));
process.exit(ok ? 0 : 1);
