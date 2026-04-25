#!/usr/bin/env node
/**
 * product-surface policy §11.1 — spot-check `metadata.title` / first visible title on Core pages.
 * Usage: node scripts/audit-core-metadata.mjs [--strict]
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "app", "(dashboard)");
const strict = process.argv.includes("--strict");

/** Keep aligned with scripts/audit-core-terminology.mjs CORE_GLOBS. */
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

const files = CORE_GLOBS.map((rel) => join(root, rel)).filter((p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
});

const missing = [];
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const hasExportMetadata = /export\s+(async\s+)?function\s+generateMetadata|export\s+const\s+metadata\s*=/.test(
    raw
  );
  const hasDisplayTitle = /ui-display-title/.test(raw);
  if (!hasExportMetadata && !hasDisplayTitle) {
    missing.push(file);
  }
}

if (missing.length) {
  console.error("Core metadata audit: pages without exported metadata() or ui-display-title\n");
  for (const m of missing) console.error(`  ${m}\n`);
  if (strict) process.exit(1);
} else {
  console.log("Core metadata audit: each scoped page has metadata export or ui-display-title.");
}
