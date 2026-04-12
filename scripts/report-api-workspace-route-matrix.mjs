#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  findFamilyPolicy,
  isExemptByPrefix,
  isSessionAuthenticatedRoute,
} from "./lib/api-workspace-route-policy.mjs";

const ROOT = process.cwd();
const API_ROOT = join(ROOT, "src", "app", "api");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

function toApiPath(abs) {
  const rel = abs.replace(`${ROOT}/src/app`, "").replace(/\\/g, "/");
  return rel.startsWith("/") ? rel : `/${rel}`;
}

const routeFiles = walk(API_ROOT);
const rows = [];

for (const file of routeFiles) {
  const apiPath = toApiPath(file);
  const raw = readFileSync(file, "utf8");
  const familyPolicy = findFamilyPolicy(apiPath);
  const exemptReason = raw.includes("V7 exempt:")
    ? "inline_v7_exempt_comment"
    : isExemptByPrefix(apiPath)
      ? "prefix_exempt"
      : null;
  rows.push({
    apiPath,
    familyPrefix: familyPolicy?.prefix ?? null,
    minMode: familyPolicy?.minMode ?? null,
    modeMismatchStatus: familyPolicy?.modeMismatchStatus ?? null,
    isSessionRoute: isSessionAuthenticatedRoute(raw),
    hasEligibilityGuard: raw.includes("requireApiWorkspaceEligibility"),
    exemptReason,
  });
}

rows.sort((a, b) => a.apiPath.localeCompare(b.apiPath));
console.log(JSON.stringify(rows, null, 2));
