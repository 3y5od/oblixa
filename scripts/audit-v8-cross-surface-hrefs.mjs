#!/usr/bin/env node
/**
 * Heuristic scan: hardcoded dashboard hrefs to governed surfaces should appear with
 * eligibility helpers nearby. Tune via scripts/v7-href-audit-allowlist.txt (glob, exact path, or
 * trailing `/` directory prefix per line; `#` comments).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const RISK_ALT =
  "decisions|campaigns|assurance|relationship-workspaces|contracts/programs|accounts|counterparties|contracts/maintenance|contracts/collaboration";
const RISK_HREF_RE = new RegExp(`href=\\{?["'\`]\\/(${RISK_ALT})`, "m");
const RISK_HREF_TEMPLATE_RE = new RegExp(`href=\\{\\s*\`\\/(${RISK_ALT})`, "m");
const RISK_PUSH_RE = new RegExp(`router\\.push\\(\\s*["'\`]\\/(${RISK_ALT})`, "m");
const GUARD_RE =
  /isHrefEligibleForProductSurface|evaluateFeatureEligibility|isAdvancedModuleHidden|isAssuranceModuleHidden|loadProductSurfaceContext|showDecisionsCta|showCampaigns|showAssuranceMode|showCampaignSurfaces|showDecisionSignals|relationshipsVisible|canViewAssuranceOps|V7 exempt:/;
const ALLOWLIST_FILE = join(ROOT, "scripts", "v7-href-audit-allowlist.txt");
const NATIVE_TREE_REL_PREFIXES = [
  "src/app/(dashboard)/decisions",
  "src/app/(dashboard)/campaigns",
  "src/app/(dashboard)/assurance",
  "src/app/(dashboard)/relationship-workspaces",
];

function normalizeRel(p) {
  return p.split(join.sep).join("/");
}
function loadAllowlist() {
  try {
    const raw = readFileSync(ALLOWLIST_FILE, "utf8");
    return raw
      .split("\n")
      .map((l) => l.split("#")[0].trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (
      (name.endsWith(".tsx") || name.endsWith(".ts")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx") &&
      !name.endsWith(".spec.ts") &&
      !name.endsWith(".spec.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}
function isAllowed(relPosix, allowEntries) {
  for (const g of allowEntries) {
    if (g.endsWith("/")) {
      const pre = g.slice(0, -1);
      if (relPosix === pre || relPosix.startsWith(g)) return true;
      continue;
    }
    if (g.endsWith("*")) {
      const pre = g.slice(0, -1);
      if (relPosix.startsWith(pre)) return true;
      continue;
    }
    if (relPosix === g || relPosix.endsWith(`/${g}`)) return true;
  }
  return false;
}
function isNativeFeatureTreeFile(relPosix) {
  for (const pre of NATIVE_TREE_REL_PREFIXES) {
    if (relPosix === pre || relPosix.startsWith(`${pre}/`)) return true;
  }
  return false;
}
function fileHasRisk(raw) {
  return RISK_HREF_RE.test(raw) || RISK_HREF_TEMPLATE_RE.test(raw) || RISK_PUSH_RE.test(raw);
}

const scanRoots = [join(ROOT, "src", "app", "(dashboard)"), join(ROOT, "src", "components"), join(ROOT, "src", "lib")];
const allowEntries = loadAllowlist().map((g) => normalizeRel(g));
const rootsExist = scanRoots.filter((d) => {
  try {
    statSync(d);
    return true;
  } catch {
    return false;
  }
});
const files = rootsExist.flatMap((d) => walk(d));
const violations = [];
for (const file of files) {
  const rel = normalizeRel(relative(ROOT, file));
  if (isAllowed(rel, allowEntries)) continue;
  if (isNativeFeatureTreeFile(rel)) continue;
  const raw = readFileSync(file, "utf8");
  if (!fileHasRisk(raw)) continue;
  if (GUARD_RE.test(raw)) continue;
  violations.push(rel);
}

if (violations.length === 0) {
  console.log("V8 cross-surface href audit passed.");
  process.exit(0);
}
console.error("V8 href audit: risky href patterns without obvious eligibility guard token:");
for (const v of violations) console.error(` - ${v}`);
if (STRICT) process.exit(1);
console.error("\nNon-strict: re-run with --strict to fail CI.");
process.exit(0);
