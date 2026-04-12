#!/usr/bin/env node
/**
 * docs/refinement.md §2 + §22.1 — execution identity must not foreground assurance/campaign/autopilot
 * as the primary product story on marketing, auth, external, and root entry surfaces.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");

const SCAN_ROOTS = [
  join(root, "src", "components", "landing"),
  join(root, "src", "app", "(auth)"),
  join(root, "src", "app", "(external)"),
  join(root, "src", "app", "(marketing)"),
];

const SINGLE_FILES = [
  join(root, "src", "app", "page.tsx"),
  join(root, "src", "components", "auth", "auth-legal-footer.tsx"),
  join(root, "src", "components", "dashboard", "onboarding-banner.tsx"),
  join(root, "src", "components", "dashboard", "usage-section.tsx"),
];

/** Phrases that should not headline default product identity on these surfaces. */
const FORBIDDEN = [
  { re: /\bassurance\b/i, label: "assurance" },
  { re: /\bautopilot\b/i, label: "autopilot" },
  { re: /\bcampaigns?\b/i, label: "campaign(s)" },
  { re: /\bscorecard\b/i, label: "scorecard" },
  { re: /\bplaybook\b/i, label: "playbook" },
  { re: /\boutcome\s+intelligence\b/i, label: "outcome intelligence" },
];

function walkTsx(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsx(p, out);
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const files = new Set();
for (const d of SCAN_ROOTS) walkTsx(d).forEach((f) => files.add(f));
for (const f of SINGLE_FILES) {
  if (statSync(f, { throwIfNoEntry: false })?.isFile()) files.add(f);
}

const violations = [];
for (const file of [...files].sort()) {
  const text = readFileSync(file, "utf8");
  for (const { re, label } of FORBIDDEN) {
    if (re.test(text)) {
      violations.push({ file, label });
    }
  }
}

if (violations.length > 0) {
  console.error("Marketing / execution-identity audit: forbidden lemmas on public-facing surfaces:\n");
  for (const v of violations) {
    console.error(`  ${v.label}: ${v.file}`);
  }
  if (strict) process.exit(1);
  process.exit(0);
}

console.log(
  `Marketing identity audit: ${files.size} files scanned — no forbidden primary-story lemmas matched.`
);
