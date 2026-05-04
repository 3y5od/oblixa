#!/usr/bin/env node
/**
 * Fails when an API route.ts appears to perform privileged/mutating work without
 * rateLimitCheck unless listed in scripts/api-route-rate-limit-allowlist.txt.
 *
 * Also reports ordering hints to keep rate limiting before expensive DB calls.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const allowlistPath = path.join(__dirname, "api-route-rate-limit-allowlist.txt");
const reportOnly = process.argv.includes("--report");
const strict = process.argv.includes("--strict");

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
  const set = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
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
const violations = [];
const orderingWarnings = [];

function indexOfMatch(text, re) {
  const m = text.match(re);
  return m?.index ?? -1;
}

function extractBracedBlock(text, openBraceIdx) {
  if (openBraceIdx < 0 || text[openBraceIdx] !== "{") return null;
  let depth = 0;
  for (let i = openBraceIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(openBraceIdx, i + 1);
    }
  }
  return null;
}

function extractExportedHandlerBlocks(text) {
  const blocks = [];
  const patterns = [
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    /export\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*async\b/g,
  ];

  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const start = match.index ?? -1;
      if (start < 0) continue;
      const openBraceIdx = text.indexOf("{", start);
      const block = extractBracedBlock(text, openBraceIdx);
      if (block) blocks.push(block);
    }
  }

  return blocks;
}

const SHARED_RATE_LIMIT_RE = /\brateLimitCheck\b|\bwith(?:V6)?CronRoute\b|\brunCronRoute\b/;
const MUTATION_HANDLER_RE = /\bexport\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/;
const DB_TOUCH_RE =
  /\bcreateAdminClient\b|\bcreateClient\b|\bcreateServerClient\b|\.from\s*\(|\bupsert\s*\(|\binsert\s*\(|\bupdate\s*\(|\bdelete\s*\(/;
const DB_MUTATION_RE = /\bupsert\s*\(|\binsert\s*\(|\bupdate\s*\(|\bdelete\s*\(/;
const ORDERING_DB_TOUCH_RE = /\.from\s*\(|\bupsert\s*\(|\binsert\s*\(|\bupdate\s*\(|\bdelete\s*\(/;

for (const abs of routes) {
  const rel = toApiRelative(abs);
  if (allowlist.has(rel)) continue;
  const text = fs.readFileSync(abs, "utf8");
  const hasRateLimit = SHARED_RATE_LIMIT_RE.test(text);
  const isMutatingHandler = MUTATION_HANDLER_RE.test(text);
  const hasDbTouch = DB_TOUCH_RE.test(text);
  const hasDbMutation = DB_MUTATION_RE.test(text);
  const needsRateLimit = /\bcreateAdminClient\b/.test(text) || (strict && (hasDbTouch || isMutatingHandler || hasDbMutation));

  if (needsRateLimit && !hasRateLimit) {
    violations.push(rel);
    continue;
  }

  if (hasRateLimit && (hasDbTouch || hasDbMutation)) {
    const handlerBlocks = extractExportedHandlerBlocks(text);
    for (const block of handlerBlocks) {
      const rateLimitIdx = indexOfMatch(block, /\brateLimitCheck\s*\(/);
      const dbIdx = indexOfMatch(block, ORDERING_DB_TOUCH_RE);
      if (rateLimitIdx >= 0 && dbIdx >= 0 && dbIdx < rateLimitIdx) {
        orderingWarnings.push(rel);
        break;
      }
    }
  }
}

if (violations.length > 0) {
  console.log(
    JSON.stringify(
      {
        totalRoutes: routes.length,
        violationCount: violations.length,
        orderingWarningCount: orderingWarnings.length,
        violations,
        orderingWarnings,
      },
      null,
      2
    )
  );
  if (reportOnly) process.exit(0);
  console.error(
    "API route(s) perform mutating/privileged work without rateLimitCheck and are not allowlisted:\n"
  );
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    "\nAdd rateLimitCheck (after auth) or list the path in scripts/api-route-rate-limit-allowlist.txt with a short comment line above it."
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      totalRoutes: routes.length,
      violationCount: 0,
      orderingWarningCount: orderingWarnings.length,
      violations: [],
      orderingWarnings,
    },
    null,
    2
  )
);

if (reportOnly) process.exit(0);

if (orderingWarnings.length > 0) {
  console.warn(
    `WARN: ${orderingWarnings.length} route(s) may call DB work before rateLimitCheck (review ordering).`
  );
}

console.log(`OK: ${routes.length} API route(s) satisfy rate-limit coverage (or allowlist).`);
