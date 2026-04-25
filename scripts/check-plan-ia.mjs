#!/usr/bin/env node
/**
 * product-surface policy §4.4 — plan billing must not drive IA (navigation / mode / landing).
 * Fails if orgHasActivePlan or isPlanEnforcementEnabled appears in product-surface or navigation.
 */
import { execSync } from "node:child_process";

const root = process.cwd();
const allowlist = ["src/lib/plan.ts", "src/lib/billing", "stripe", "checkout", "portal"];

function isAllowlisted(path) {
  return allowlist.some((a) => path.includes(a));
}

let out = "";
try {
  out = execSync(
    `grep -rEl "orgHasActivePlan|isPlanEnforcementEnabled" src --include="*.ts" --include="*.tsx"`,
    { encoding: "utf8", cwd: root }
  ).trim();
} catch {
  out = "";
}

const hits = out
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((p) => !isAllowlisted(p));

const suspicious = hits.filter(
  (p) =>
    p.includes("product-surface") ||
    p.includes("navigation") ||
    p.includes("/layout.tsx") ||
    p.includes("default_landing") ||
    p.includes("sidebar") ||
    p.includes("command-palette")
);

if (suspicious.length) {
  console.error("§4.4 plan/IA audit: plan helpers referenced in product IA paths:\n");
  for (const p of suspicious) console.error(`  ${p}`);
  process.exit(1);
}

console.log("§4.4 plan/IA audit: no plan enforcement in navigation/product-surface paths.");
