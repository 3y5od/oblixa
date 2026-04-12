#!/usr/bin/env node
/**
 * docs/refinement.md §11.3 — Workspace primary links vs page titles (heuristic).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dashboardRoot = join(process.cwd(), "src", "app", "(dashboard)");

/** PRIMARY_NAV_GROUPS "Workspace" hrefs → nav label on the item */
const WORKSPACE = [
  { href: "/dashboard", nav: "Home" },
  { href: "/contracts", nav: "Contracts" },
  { href: "/contracts/review", nav: "Review" },
  { href: "/work", nav: "Work" },
  { href: "/contracts/renewals", nav: "Renewals" },
  { href: "/contracts/exceptions", nav: "Exceptions" },
  { href: "/contracts/evidence-studio", nav: "Evidence" },
  { href: "/reports", nav: "Reports" },
  { href: "/settings", nav: "Settings" },
];

function pagePathForHref(href) {
  const pathPart = href.replace(/^\//, "");
  return join(dashboardRoot, pathPart, "page.tsx");
}

function findMetadataTitle(absPage) {
  const raw = readFileSync(absPage, "utf8");
  const idx = raw.indexOf("export const metadata");
  if (idx === -1) return null;
  const slice = raw.slice(idx, idx + 1200);
  const m = slice.match(/title:\s*["']([^"']+)["']/);
  return m ? m[1] : null;
}

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlesCompatible(navLabel, pageTitle) {
  const a = normalize(navLabel);
  const b = normalize(pageTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  if ((a === "home" && b === "dashboard") || (a === "dashboard" && b === "home")) return true;
  if (a === "evidence" && b.includes("evidence")) return true;
  if (a === "reports" && b.includes("report")) return true;
  if (a === "settings" && b.includes("setting")) return true;
  return false;
}

const mismatches = [];
for (const { href, nav } of WORKSPACE) {
  const page = pagePathForHref(href);
  if (!existsSync(page)) {
    mismatches.push({ href, nav, reason: `missing page ${page}` });
    continue;
  }
  const title = findMetadataTitle(page);
  if (!title) {
    continue;
  }
  if (!titlesCompatible(nav, title)) {
    mismatches.push({ href, nav, title, reason: "nav label vs metadata.title mismatch" });
  }
}

if (mismatches.length) {
  console.error("Nav vs metadata audit (Workspace group):\n");
  for (const m of mismatches) {
    console.error(`  ${m.href} (nav: ${m.nav}) — ${m.reason}${m.title ? ` (title: ${m.title})` : ""}`);
  }
  process.exit(1);
}

console.log("Nav vs metadata audit: Workspace group titles look compatible.");
