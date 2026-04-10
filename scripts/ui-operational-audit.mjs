#!/usr/bin/env node
/**
 * Heuristic audit for legacy "big number in ui-card" KPI tiles outside operational primitives.
 * Does not parse TSX; use as a hygiene signal, not a hard gate.
 *
 * Usage: node scripts/ui-operational-audit.mjs [--strict]
 *   --strict  exit 1 if any matches are found
 *
 * Wave 2: also flags legacy chrome on the app header (prefer design tokens).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "app");
const headerPath = join(process.cwd(), "src", "components", "layout", "header.tsx");
const legalFooterPath = join(process.cwd(), "src", "components", "layout", "legal-footer.tsx");
const strict = process.argv.includes("--strict");

const LEGACY_KPI = /text-2xl\s+font-semibold\s+text-zinc-900/;
const WHY_PROSE = /\bWhy:\s/;
/** Hero-style metrics: large type + tabular numbers (often paired with zinc-950). */
const HERO_METRIC_TABULAR = /text-2xl[\s\S]{0,120}tabular-nums|tabular-nums[\s\S]{0,120}text-2xl/;
const DD_ZINC_950 = /<dd[^>]*className=\{?["'`][^"'`]*text-zinc-950/;

function walkFiles(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(p, out);
    else if (name === "page.tsx" || name === "loading.tsx") out.push(p);
  }
  return out;
}

const files = walkFiles(root);
const hits = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = file.replace(process.cwd() + "/", "");
  const lines = text.split("\n");
  const isPage = rel.endsWith("page.tsx");

  lines.forEach((line, i) => {
    if (LEGACY_KPI.test(line)) {
      hits.push({ rel, line: i + 1, kind: "legacy-kpi-tile", snippet: line.trim().slice(0, 120) });
    }
    if (WHY_PROSE.test(line) && rel.includes("(dashboard)")) {
      hits.push({ rel, line: i + 1, kind: "why-prose", snippet: line.trim().slice(0, 120) });
    }
    if (HERO_METRIC_TABULAR.test(line)) {
      hits.push({ rel, line: i + 1, kind: "hero-metric-tabular", snippet: line.trim().slice(0, 120) });
    }
    if (isPage && DD_ZINC_950.test(line)) {
      hits.push({ rel, line: i + 1, kind: "page-dd-zinc-950", snippet: line.trim().slice(0, 120) });
    }
  });
}

try {
  const headerSrc = readFileSync(headerPath, "utf8");
  const rel = "src/components/layout/header.tsx";
  if (/\bbg-white\b/.test(headerSrc)) {
    hits.push({
      rel,
      line: 0,
      kind: "wave2-header-bg-white",
      snippet: "Use bg-surface (or token) for header chrome, not bg-white",
    });
  }
} catch {
  /* header missing — ignore */
}

try {
  const footerSrc = readFileSync(legalFooterPath, "utf8");
  const rel = "src/components/layout/legal-footer.tsx";
  if (/\bbg-white\b/.test(footerSrc)) {
    hits.push({
      rel,
      line: 0,
      kind: "wave2-footer-bg-white",
      snippet: "Use bg-surface for footer chrome, not bg-white",
    });
  }
} catch {
  /* footer missing — ignore */
}

console.log(`UI operational audit: scanned ${files.length} app routes (page.tsx / loading.tsx)`);
if (hits.length === 0) {
  console.log("No legacy KPI / hero-metric / dl / Wave2 header-footer patterns matched (heuristic).");
  process.exit(0);
}

console.log(`Found ${hits.length} match(es):\n`);
for (const h of hits) {
  console.log(`${h.rel}:${h.line} [${h.kind}] ${h.snippet}`);
}

if (strict) {
  console.error("\nStrict mode: fix or exclude false positives, then re-run.");
  process.exit(1);
}
process.exit(0);
