#!/usr/bin/env node
/**
 * product-surface policy §4.4 — plan billing must not drive IA (navigation / mode / landing).
 * Fails if orgHasActivePlan or isPlanEnforcementEnabled appears in product-surface or navigation.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const allowlist = ["src/lib/plan.ts", "src/lib/billing", "stripe", "checkout", "portal"];
const planIaPattern = /orgHasActivePlan|isPlanEnforcementEnabled/u;

function isAllowlisted(path) {
  return allowlist.some((a) => path.includes(a));
}

function walkSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(absolute, out);
      continue;
    }
    if (/\.(ts|tsx)$/u.test(entry.name)) out.push(absolute);
  }
  return out;
}

export function analyzePlanIaReferences(repoRoot = root) {
  const hits = walkSourceFiles(path.join(repoRoot, "src"))
    .map((absolute) => path.relative(repoRoot, absolute).replace(/\\/gu, "/"))
    .filter((relative) => planIaPattern.test(fs.readFileSync(path.join(repoRoot, relative), "utf8")))
    .filter((relative) => !isAllowlisted(relative));

  const suspicious = hits.filter(
    (p) =>
      p.includes("product-surface") ||
      p.includes("navigation") ||
      p.includes("/layout.tsx") ||
      p.includes("default_landing") ||
      p.includes("sidebar") ||
      p.includes("command-palette")
  );

  return { ok: suspicious.length === 0, hits, suspicious };
}

export function runPlanIaCheck() {
  const report = analyzePlanIaReferences(root);
  if (report.suspicious.length) {
    console.error("§4.4 plan/IA audit: plan helpers referenced in product IA paths:\n");
    for (const p of report.suspicious) console.error(`  ${p}`);
    process.exit(1);
  }

  console.log("§4.4 plan/IA audit: no plan enforcement in navigation/product-surface paths.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPlanIaCheck();
}
