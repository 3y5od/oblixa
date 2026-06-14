#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { loadAllowlistWithMetadata } from "./lib/allowlist.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
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

const PUBLIC_AUTH_FLOW_SIGNALS = [
  "@/lib/auth/auth-action-impl",
  "auth.signInWithPassword",
  "auth.signUp",
  "auth.resetPasswordForEmail",
  "auth.updateUser",
  "auth.signOut",
];

function isUseServerModule(source) {
  return source.includes('"use server"') || source.includes("'use server'");
}

function isPublicAuthFlow(source) {
  return PUBLIC_AUTH_FLOW_SIGNALS.some((marker) => source.includes(marker));
}

export function analyzeServerActionOrgScope(rootDir = root, options = {}) {
  const currentActionsRoot = path.join(rootDir, "src", "actions");
  const currentAllowlistPath =
    options.allowlistPath ?? (rootDir === root ? allowlistPath : path.join(rootDir, "scripts", "server-action-org-scope-allowlist.txt"));
  const allowlist = loadAllowlistWithMetadata(currentAllowlistPath);
  const files = walkActions(currentActionsRoot).sort();
  const violations = [];
  const staleAllowlistEntries = [];
  const coverage = [];

  for (const abs of files) {
    const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    if (!isUseServerModule(source)) continue;
    if (allowlist.entries.has(rel)) continue;
    const exportCount = exportedAsyncFunctions(source).length;
    if (exportCount === 0) continue;

    const scopeSignalCount = SCOPE_SIGNALS.filter((marker) => source.includes(marker)).length;
    const publicAuthFlow = isPublicAuthFlow(source);
    coverage.push({
      file: rel,
      exportCount,
      scopeSignalCount,
      publicAuthFlow,
    });
    if (scopeSignalCount === 0 && !publicAuthFlow) violations.push(rel);
  }

  for (const rel of allowlist.entries) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) staleAllowlistEntries.push(rel);
  }

  return {
    totalActionFiles: files.length,
    violationCount: violations.length,
    staleAllowlistCount: staleAllowlistEntries.length,
    allowlistMetadataIssueCount: allowlist.metadataIssues.length,
    violations,
    staleAllowlistEntries,
    allowlistMetadataIssues: allowlist.metadataIssues,
    coverage,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const payload = analyzeServerActionOrgScope();
  console.log(JSON.stringify(payload, null, 2));

  if (reportOnly) process.exit(0);
  if (payload.allowlistMetadataIssues.length > 0) process.exit(1);
  if (payload.staleAllowlistEntries.length > 0) process.exit(1);
  if (payload.violations.length > 0) process.exit(1);
}
