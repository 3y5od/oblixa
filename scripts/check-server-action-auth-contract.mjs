#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadAllowlistWithMetadata } from "./lib/allowlist.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsRoot = path.join(root, "src", "actions");
const allowlistPath = path.join(__dirname, "server-action-auth-contract-allowlist.txt");
const reportOnly = process.argv.includes("--report");
const strict = process.argv.includes("--strict");

function walkActions(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkActions(p, acc);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

function toRelative(abs) {
  return path.relative(root, abs).replace(/\\/g, "/");
}

function exportedAsyncFunctions(source) {
  return [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
}

const AUTH_SIGNALS = [
  "auth.getUser(",
  "getAuthContext(",
  "getAuthenticatedActionContext(",
  "getAuthenticatedMembershipContext(",
  "getOrEnsureDeterministicMembership(",
  "getDeterministicMembership(",
  "createClient(",
];

const DENY_SIGNALS = [
  "Not authenticated",
  "Unauthorized",
  "Access denied",
  "No organization",
  "No membership",
  "No organization found",
];

const DENY_EXEMPT_ACTIONS = new Set([
  "src/actions/auth.ts",
  "src/actions/watchlists.ts",
]);

const allowlist = loadAllowlistWithMetadata(allowlistPath);
const files = walkActions(actionsRoot).sort();
const authViolations = [];
const denyViolations = [];
const staleAllowlistEntries = [];
const coverage = [];

for (const abs of files) {
  const rel = toRelative(abs);
  const source = fs.readFileSync(abs, "utf8");
  if (!source.includes('"use server"')) continue;
  if (allowlist.entries.has(rel)) continue;
  const exportCount = exportedAsyncFunctions(source).length;
  if (exportCount === 0) continue;

  const authSignalCount = AUTH_SIGNALS.filter((marker) => source.includes(marker)).length;
  const denySignalCount = DENY_SIGNALS.filter((marker) => source.includes(marker)).length;
  coverage.push({
    file: rel,
    exportCount,
    authSignalCount,
    denySignalCount,
  });
  if (authSignalCount === 0) authViolations.push(rel);
  if (strict && denySignalCount === 0 && !DENY_EXEMPT_ACTIONS.has(rel)) {
    denyViolations.push(rel);
  }
}

for (const rel of allowlist.entries) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) staleAllowlistEntries.push(rel);
}

const payload = {
  totalActionFiles: files.length,
  authViolationCount: authViolations.length,
  denyViolationCount: denyViolations.length,
  staleAllowlistCount: staleAllowlistEntries.length,
  allowlistMetadataIssueCount: allowlist.metadataIssues.length,
  authViolations,
  denyViolations,
  staleAllowlistEntries,
  allowlistMetadataIssues: allowlist.metadataIssues,
  coverage,
};

console.log(JSON.stringify(payload, null, 2));

if (reportOnly) process.exit(0);
if (allowlist.metadataIssues.length > 0) process.exit(1);
if (staleAllowlistEntries.length > 0) process.exit(1);
if (authViolations.length > 0) process.exit(1);
if (strict && denyViolations.length > 0) process.exit(1);
