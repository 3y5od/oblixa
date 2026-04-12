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
const STRICT = process.argv.includes("--strict");

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
const missing = [];

for (const file of routeFiles) {
  const apiPath = toApiPath(file);
  const family = findFamilyPolicy(apiPath);
  if (!family) continue;
  if (isExemptByPrefix(apiPath)) continue;

  const raw = readFileSync(file, "utf8");
  if (raw.includes("V7 exempt:")) continue;
  if (!isSessionAuthenticatedRoute(raw)) continue;
  if (!raw.includes("requireApiWorkspaceEligibility")) {
    missing.push(apiPath);
  }
}

if (missing.length === 0) {
  console.log("API workspace eligibility check passed.");
  process.exit(0);
}

console.log("Routes missing requireApiWorkspaceEligibility:");
for (const p of missing) console.log(` - ${p}`);

if (STRICT) {
  process.exit(1);
}

console.log(
  "\nNon-strict mode: warning only. Re-run with --strict to fail."
);
