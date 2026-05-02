#!/usr/bin/env node
/**
 * Enforce SSRF-safe outbound HTTP: route.ts files that call global fetch( )
 * must import safeFetch from @/lib/security/safe-fetch (or be allowlisted).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "outbound-fetch-allowlist.txt");

const fetchCall = /\bfetch\s*\(/;

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
  const routes = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    routes.add(t.replace(/\\/g, "/"));
  }
  return routes;
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

const allowlisted = loadAllowlist();
const routes = walkRoutes(apiRoot);
const violations = [];

for (const abs of routes) {
  const rel = toApiRelative(abs);
  if (allowlisted.has(rel)) continue;
  const raw = fs.readFileSync(abs, "utf8");
  if (!fetchCall.test(raw)) continue;
  const hasSafeFetchImport =
    /from\s+["']@\/lib\/security\/safe-fetch["']/.test(raw) ||
    /from\s+["']\.\.\/.*safe-fetch["']/.test(raw);
  const usesSafeFetchCall = /\bsafeFetch\s*\(/.test(raw);
  if (hasSafeFetchImport && usesSafeFetchCall) continue;
  if (hasSafeFetchImport && !fetchCall.test(raw.replace(/\bsafeFetch\s*\(/g, ""))) continue;
  violations.push(rel);
}

const reportOnly = process.argv.includes("--report");
if (violations.length) {
  const body = {
    checkId: "outbound-fetch",
    ok: false,
    violationCount: violations.length,
    violations,
    hint: "Import safeFetch from @/lib/security/safe-fetch or add route to scripts/outbound-fetch-allowlist.txt with # meta: owner=... expiry=... reason=...",
  };
  console.error(JSON.stringify(body, null, 2));
  if (!reportOnly) process.exit(1);
} else {
  console.log(JSON.stringify({ checkId: "outbound-fetch", ok: true, routesChecked: routes.length }, null, 2));
}
