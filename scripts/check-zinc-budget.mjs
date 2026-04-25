#!/usr/bin/env node
/**
 * Fails if Tailwind `zinc-*` utilities appear in product source.
 * Default ceiling is 0 (ratchet). Override for transitional PRs: node scripts/check-zinc-budget.mjs --max 5
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcRoot = path.join(root, "src");
const ZINC = /zinc-/;

let maxAllowed = 0;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--max" && argv[i + 1]) {
    maxAllowed = Math.max(0, parseInt(argv[i + 1], 10) || 0);
    i++;
  }
}

const exts = new Set([".ts", ".tsx", ".css"]);

function* walk(dir) {
  const names = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of names) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      yield* walk(p);
    } else {
      const ext = path.extname(e.name);
      if (exts.has(ext)) yield p;
    }
  }
}

const hits = [];
for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, "utf8");
  if (!ZINC.test(text)) continue;
  const rel = path.relative(root, file);
  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    if (!line.includes("zinc-")) return;
    const m = line.match(/zinc-[a-z0-9/%-]+/);
    hits.push({ file: rel, line: idx + 1, sample: m?.[0] ?? "zinc-…" });
  });
}

if (hits.length > maxAllowed) {
  console.error(
    `check-zinc-budget: FAIL — ${hits.length} match(es), ceiling ${maxAllowed}. ` +
      `Remove zinc-* from src or pass --max ${hits.length} temporarily.`
  );
  for (const h of hits.slice(0, 30)) {
    console.error(`  ${h.file}:${h.line}  ${h.sample}`);
  }
  if (hits.length > 30) console.error(`  … and ${hits.length - 30} more`);
  process.exit(1);
}

console.log(`check-zinc-budget: OK (${hits.length} zinc-* match(es), ceiling ${maxAllowed})`);
process.exit(0);
