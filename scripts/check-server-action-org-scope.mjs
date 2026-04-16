#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadAllowlistWithMetadata } from "./lib/allowlist.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsRoot = path.join(root, "src", "actions");
const allowlistPath = path.join(__dirname, "server-action-org-scope-allowlist.txt");
const reportOnly = process.argv.includes("--report");

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

const SCOPE_SIGNALS = [
  "organization_id",
  "orgId",
  "getOrgMemberRole(",
  "getContractAccessContext(",
  "getOrEnsureDeterministicMembership(",
  "getDeterministicMembership(",
  "getAuthenticatedMembershipContext(",
  "requireServerActionEligibility(",
  ".eq(\"organization_id\"",
  ".eq('organization_id'",
];

const allowlist = loadAllowlistWithMetadata(allowlistPath);
const files = walkActions(actionsRoot).sort();
const violations = [];
const staleAllowlistEntries = [];
const coverage = [];

for (const abs of files) {
  const rel = toRelative(abs);
  const source = fs.readFileSync(abs, "utf8");
  if (!source.includes('"use server"')) continue;
  if (allowlist.entries.has(rel)) continue;
  const exportCount = exportedAsyncFunctions(source).length;
  if (exportCount === 0) continue;

  const scopeSignalCount = SCOPE_SIGNALS.filter((marker) => source.includes(marker)).length;
  coverage.push({
    file: rel,
    exportCount,
    scopeSignalCount,
  });
  if (scopeSignalCount === 0) violations.push(rel);
}

for (const rel of allowlist.entries) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) staleAllowlistEntries.push(rel);
}

const payload = {
  totalActionFiles: files.length,
  violationCount: violations.length,
  staleAllowlistCount: staleAllowlistEntries.length,
  allowlistMetadataIssueCount: allowlist.metadataIssues.length,
  violations,
  staleAllowlistEntries,
  allowlistMetadataIssues: allowlist.metadataIssues,
  coverage,
};

console.log(JSON.stringify(payload, null, 2));

if (reportOnly) process.exit(0);
if (allowlist.metadataIssues.length > 0) process.exit(1);
if (staleAllowlistEntries.length > 0) process.exit(1);
if (violations.length > 0) process.exit(1);
