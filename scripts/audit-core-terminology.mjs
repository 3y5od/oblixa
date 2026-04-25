#!/usr/bin/env node
/**
 * product-surface policy §11.2 — flag advanced/assurance lemmas on Core route surfaces (heuristic).
 * Usage: node scripts/audit-core-terminology.mjs [--strict]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "app", "(dashboard)");
const strict = process.argv.includes("--strict");

/** Keep aligned with `coreDashboardPageRelPaths()` in route-inventory.ts (§10.1 Core). */
const CORE_GLOBS = [
  "dashboard/page.tsx",
  "contracts/page.tsx",
  "contracts/new/page.tsx",
  "contracts/bulk/page.tsx",
  "contracts/review/page.tsx",
  "work/page.tsx",
  "contracts/tasks/page.tsx",
  "contracts/obligations/page.tsx",
  "contracts/approvals/page.tsx",
  "contracts/renewals/page.tsx",
  "contracts/exceptions/page.tsx",
  "contracts/evidence-studio/page.tsx",
  "contracts/reports/page.tsx",
  "reports/page.tsx",
  "settings/page.tsx",
  "settings/billing/page.tsx",
  "settings/operations/page.tsx",
  "contracts/[id]/page.tsx",
];

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

const files = CORE_GLOBS.map((rel) => join(root, rel)).filter((p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
});

const hits = [];
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const text = raw
    .split("\n")
    .filter((line) => !/^\s*import\s/.test(line))
    .join("\n");
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      hits.push({ file, pattern: re.toString() });
    }
  }
}

if (hits.length) {
  console.error("Core terminology audit: potential §11.2 leaks\n");
  for (const h of hits) {
    console.error(`  ${h.file}\n    matched ${h.pattern}\n`);
  }
  if (strict) process.exit(1);
} else {
  console.log("Core terminology audit: no forbidden lemmas matched in scoped Core pages.");
}
