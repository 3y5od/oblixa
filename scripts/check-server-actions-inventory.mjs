#!/usr/bin/env node
/**
 * Server action inventory contract for exported "use server" modules.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsRoot = path.join(root, "src", "actions");

const AUTH_RE =
  /\b(auth\.getUser|getAuthContext|getApiAuthContext|getAuthenticatedActionContext|getAuthenticatedMembershipContext|getUser|getSession|createClient)\b/;
const ORG_SCOPE_RE =
  /\b(orgId|organization_id|getOrgMemberRole|getContractAccessContext|getDeterministicMembership|getOrEnsureDeterministicMembership|getAuthenticatedMembershipContext|requireServerActionEligibility|requireContractWriteAccess)\b|\.eq\(\s*["']organization_id["']/;
const PRIVILEGED_RE =
  /\b(requireServerActionEligibility|requireContractWriteAccess|hasOrgCapability|canManageCapability|requireRoleAtLeast|recordSecurityAuditEvent|recordV10[A-Za-z]+Mutation)\b/;
const PUBLIC_AUTH_FLOW_RE =
  /\b(auth\.signInWithPassword|auth\.signUp|auth\.resetPasswordForEmail|auth\.updateUser|auth\.signOut|RATE_LIMITS\.(signIn|signUp|forgotPassword|resetPassword))\b/;
const SAFE_ERROR_RETURN_RE =
  /\b(mapDataSourceError|mapAuthError|describeRecoverableMutationError)\s*\(/;
const RAW_ERROR_RETURN_RE =
  /return\s*\{\s*error:\s*[^\n]*(?:\.message|String\s*\(|errorMessage\s*\()/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function hasUseServer(text) {
  return /^\s*["']use server["']\s*;?/m.test(text);
}

function exportedAsyncFunctions(text) {
  return [...text.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((match) => match[1]);
}

function classifyActionModule(text) {
  const classifications = [];
  if (PUBLIC_AUTH_FLOW_RE.test(text)) classifications.push("public_auth_flow");
  if (AUTH_RE.test(text)) classifications.push("authenticated");
  if (ORG_SCOPE_RE.test(text)) classifications.push("org_scoped");
  if (PRIVILEGED_RE.test(text)) classifications.push("privileged");
  return classifications;
}

function unsafeRedirectCalls(text) {
  const issues = [];
  const executableText = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const match of executableText.matchAll(/\b(?:redirect|permanentRedirect)\(([^)]*)\)/g)) {
    const arg = match[1]?.trim() ?? "";
    if (!/^["']\/[^"']*["']$/.test(arg)) issues.push(match[0]);
  }
  return issues;
}

function rawErrorReturns(text) {
  const executableText = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const lines = executableText.split("\n");
  const issues = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (RAW_ERROR_RETURN_RE.test(line) && !SAFE_ERROR_RETURN_RE.test(line)) {
      issues.push({ line: index + 1, source: line.trim() });
    }
  }
  return issues;
}

export function analyzeServerActionsInventory(rootDir = root) {
  const currentActionsRoot = path.join(rootDir, "src", "actions");
  const files = walk(currentActionsRoot).sort();
  const inventory = [];
  const issues = [];

  for (const abs of files) {
    const text = fs.readFileSync(abs, "utf8");
    if (!hasUseServer(text)) continue;
    const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
    const exports = exportedAsyncFunctions(text);
    if (exports.length === 0) continue;
    const classifications = classifyActionModule(text);
    const redirects = unsafeRedirectCalls(text);
    const rawErrors = rawErrorReturns(text);
    inventory.push({ file: rel, exports, classifications, rawErrorReturnCount: rawErrors.length });
    if (classifications.length === 0) issues.push({ file: rel, issue: "server_action_unclassified" });
    if (!classifications.includes("public_auth_flow") && !classifications.includes("authenticated")) {
      issues.push({ file: rel, issue: "server_action_missing_auth_classification" });
    }
    for (const call of redirects) issues.push({ file: rel, issue: "server_action_unsafe_redirect", call });
    for (const rawError of rawErrors) {
      issues.push({
        file: rel,
        issue: "server_action_raw_error_return",
        line: rawError.line,
        source: rawError.source,
      });
    }
  }

  const classificationCounts = {};
  for (const row of inventory) {
    for (const classification of row.classifications) {
      classificationCounts[classification] = (classificationCounts[classification] ?? 0) + 1;
    }
  }

  return {
    totalActionFiles: files.length,
    serverActionModuleCount: inventory.length,
    exportedActionCount: inventory.reduce((sum, row) => sum + row.exports.length, 0),
    issueCount: issues.length,
    classificationCounts,
    issues,
    inventory,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeServerActionsInventory();
  const output = process.argv.includes("--report")
    ? report
    : {
        totalActionFiles: report.totalActionFiles,
        serverActionModuleCount: report.serverActionModuleCount,
        exportedActionCount: report.exportedActionCount,
        issueCount: report.issueCount,
        classificationCounts: report.classificationCounts,
        issues: report.issues,
      };
  console.log(JSON.stringify(output, null, 2));
  if (!process.argv.includes("--report") && report.issueCount > 0) process.exit(1);
}
