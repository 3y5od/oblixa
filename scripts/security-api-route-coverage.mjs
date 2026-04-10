#!/usr/bin/env node
// Emits docs/SECURITY_API_ROUTE_COVERAGE.md — every api route.ts vs colocated test or allowlist.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "api-route-test-allowlist.txt");
const outPath = path.join(root, "docs", "SECURITY_API_ROUTE_COVERAGE.md");

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) return new Set();
  const raw = fs.readFileSync(allowlistPath, "utf8");
  const set = new Set();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    set.add(t.replace(/\\/g, "/"));
  }
  return set;
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

const routes = walkRoutes(apiRoot).sort();
const allowlist = loadAllowlist();
const rows = [];

for (const abs of routes) {
  const rel = toApiRelative(abs);
  const dir = path.dirname(abs);
  const colocated = fs.existsSync(path.join(dir, "route.test.ts"));
  const listed = allowlist.has(rel);
  rows.push({
    rel,
    colocated: colocated ? "yes" : "no",
    allowlist: listed ? "yes" : "no",
  });
}

const lines = [
  "# API route test coverage",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "Every row is a `src/app/api/**/route.ts`. **Colocated test** means `route.test.ts` in the same directory. **Allowlist** means listed in [`scripts/api-route-test-allowlist.txt`](../scripts/api-route-test-allowlist.txt) (bundled or documented coverage).",
  "",
  "Regenerate before major releases:",
  "",
  "```bash",
  "npm run report:security-api-coverage",
  "```",
  "",
  `**Total routes:** ${routes.length}`,
  "",
  "| Route | Colocated `route.test.ts` | Allowlist |",
  "|-------|---------------------------|-----------|",
];

for (const r of rows) {
  lines.push(`| \`${r.rel}\` | ${r.colocated} | ${r.allowlist} |`);
}

lines.push("");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${path.relative(root, outPath)} (${routes.length} routes).`);
