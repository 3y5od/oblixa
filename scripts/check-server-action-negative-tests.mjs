#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadAllowlistWithMetadata } from "./lib/allowlist.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ACTIONS_ROOT = path.join(ROOT, "src", "actions");
const ALLOWLIST_PATH = path.join(__dirname, "server-action-negative-tests-allowlist.txt");

const AUTH_DENIAL_RE =
  /unauthenticated|not authenticated|without (?:a|the) user|user is null|auth failure|missing session|returns 401|before auth/i;
const ORG_DENIAL_RE =
  /cross-org|cross org|org(?:anization)? scope|organization_id|\borg\b|scoped to org|scope via membership|contract access|access queries|before contract lookup|before membership lookup|contract lookup|membership lookup|not a member|membership is missing|membership missing|access denied|forbidden|returns 403|multi-org|ambiguous|source/i;
const CAPABILITY_DENIAL_RE =
  /capability|role|viewer|non-admin|not admin|caller is not admin|admin_required|requires admin|requires step-up|access denied|forbidden|returns 403|unauthorized|source|static/i;
const INPUT_DENIAL_RE =
  /invalid|malformed|required|unsafe|too long|unsupported|rejects|validation|bad input|bad payload/i;

const PUBLIC_AUTH_ACTION_RE = /^(signIn|signUp|forgotPassword|resetPassword|signOut)$/;
const AUTH_SOURCE_RE = /\b(auth\.getUser|getAuthContext|getAuthenticatedActionContext|getAuthenticatedMembershipContext|getUser|getSession|createClient|getContext|requireCalibrationContext)\b/;
const ORG_SOURCE_RE = /\b(organization_id|orgId|getOrgMemberRole|getContractAccessContext|getDeterministicMembership|getOrEnsureDeterministicMembership|getAuthenticatedMembershipContext|requireServerActionEligibility|requireContractWriteAccess|getContext|requireCalibrationContext)\b|\.eq\(\s*["']organization_id["']/;
const CAPABILITY_SOURCE_RE = /\b(hasRoleCapability|hasOrgCapability|canManageCapability|requireRoleAtLeast|canEditContracts|settings_manage|maintenance_manage|contracts_edit|approvals_manage|renewals_manage)\b/;
const INPUT_SOURCE_RE = /\b(formData|FormData|input|safeParse|parse\(|validate|zod|isUuid|containsControlOrBidi|hasUnsafeJsonKey)\b/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) walk(abs, acc);
    else if (name.endsWith(".ts")) acc.push(abs);
  }
  return acc;
}

function hasUseServer(source) {
  return /^\s*["']use server["']\s*;?/m.test(source);
}

function exportedAsyncFunctions(source) {
  return [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((match) => match[1]);
}

function functionBody(source, actionName) {
  const index = source.search(new RegExp(`export\\s+async\\s+function\\s+${actionName}\\b`));
  if (index < 0) return source;
  const nextExport = source.slice(index + 1).search(/\nexport\s+async\s+function\s+\w+/);
  return nextExport < 0 ? source.slice(index) : source.slice(index, index + 1 + nextExport);
}

function candidateTests(root, actionRel, actionName) {
  const sourceBase = path.basename(actionRel, ".ts");
  const tests = walk(path.join(root, "src", "actions")).filter((abs) => /\.(?:test|spec)\.ts$/.test(abs));
  return tests
    .map((abs) => ({
      abs,
      rel: path.relative(root, abs).replace(/\\/g, "/"),
      source: fs.readFileSync(abs, "utf8"),
    }))
    .filter((test) => {
      const relBase = path.basename(test.rel);
      return (
        relBase === `${sourceBase}.test.ts` ||
        relBase === `${sourceBase}-action-scope.test.ts` ||
        relBase === `${sourceBase}-scope.test.ts` ||
        test.source.includes(`./${sourceBase}`) ||
        test.source.includes(`@/actions/${sourceBase}`) ||
        test.source.includes(actionName)
      );
    });
}

function categoryRequirements(source, actionName) {
  const body = functionBody(source, actionName);
  const categories = [];
  if (!PUBLIC_AUTH_ACTION_RE.test(actionName) && AUTH_SOURCE_RE.test(body)) {
    categories.push("unauthenticated");
  }
  if (
    !PUBLIC_AUTH_ACTION_RE.test(actionName) &&
    !actionName.startsWith("emit") &&
    ORG_SOURCE_RE.test(body)
  ) {
    categories.push("org_scope");
  }
  if (CAPABILITY_SOURCE_RE.test(body)) categories.push("capability");
  if (INPUT_SOURCE_RE.test(body)) categories.push("invalid_input");
  return [...new Set(categories)];
}

function staticCoverageForCategory(source, body, category) {
  if (category === "unauthenticated") {
    return /\bif\s*\(\s*!\s*(?:user|ctx|session)\s*\)|return\s+\{\s*error:\s*["']Not authenticated["']|getAuthContext\(\)/.test(body);
  }
  if (category === "org_scope") {
    return /\b(requireContractWriteAccess|getContractAccessContext|requireServerActionEligibility|getAuthenticatedMembershipContext|organization_id|getOrgMemberRole)\b|\.eq\(\s*["']organization_id["']/.test(
      body
    );
  }
  if (category === "capability") {
    return /\b(requireContractWriteAccess|requireServerActionEligibility|hasRoleCapability|hasOrgCapability|canManageCapability|requireRoleAtLeast|canEditContracts|ensureProgramsSurfaceAccess)\b/.test(
      body
    );
  }
  if (category === "invalid_input") {
    return /\b(FormData|safeParse|isUuid|validate|zod|containsControlOrBidi|hasUnsafeJsonKey|Number\.isFinite|rejects unsafe|Invalid|required|unsupported)\b/.test(
      body
    );
  }
  return false;
}

function coverageForCategory(testSource, source, actionName, category) {
  const body = functionBody(source, actionName);
  if (category === "unauthenticated") return AUTH_DENIAL_RE.test(testSource) || staticCoverageForCategory(source, body, category);
  if (category === "org_scope") return ORG_DENIAL_RE.test(testSource) || staticCoverageForCategory(source, body, category);
  if (category === "capability") return CAPABILITY_DENIAL_RE.test(testSource) || staticCoverageForCategory(source, body, category);
  if (category === "invalid_input") return INPUT_DENIAL_RE.test(testSource) || staticCoverageForCategory(source, body, category);
  return false;
}

export function analyzeServerActionNegativeTests(root = ROOT) {
  const actionsRoot = path.join(root, "src", "actions");
  const allowlist = loadAllowlistWithMetadata(path.join(root, "scripts", "server-action-negative-tests-allowlist.txt"));
  const issues = [...allowlist.metadataIssues.map((issue) => ({ issue: "allowlist_metadata_invalid", ...issue }))];
  const inventory = [];

  for (const abs of walk(actionsRoot).sort()) {
    if (/\.(?:test|spec)\.ts$/.test(abs)) continue;
    const source = fs.readFileSync(abs, "utf8");
    if (!hasUseServer(source)) continue;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    for (const actionName of exportedAsyncFunctions(source)) {
      const tests = candidateTests(root, rel, actionName);
      const testSource = tests.map((test) => test.source).join("\n");
      const required = categoryRequirements(source, actionName);
      const coverage = Object.fromEntries(
        required.map((category) => [category, coverageForCategory(testSource, source, actionName, category)])
      );
      inventory.push({
        action: `${rel}#${actionName}`,
        tests: tests.map((test) => test.rel),
        required,
        coverage,
      });
      for (const category of required) {
        if (coverage[category]) continue;
        const key = `${rel}#${actionName}:${category}`;
        if (allowlist.entries.has(key)) continue;
        issues.push({
          issue: "missing_server_action_negative_test",
          action: `${rel}#${actionName}`,
          category,
        });
      }
    }
  }

  for (const entry of allowlist.entries) {
    const actionKey = entry.split(":")[0];
    if (!inventory.some((row) => row.action === actionKey)) {
      issues.push({ issue: "stale_allowlist_entry", entry });
    }
  }

  return {
    checkId: "server-action-negative-tests",
    actionCount: inventory.length,
    issueCount: issues.length,
    issues,
    inventory,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeServerActionNegativeTests();
  console.log(JSON.stringify(process.argv.includes("--report") ? report : {
    checkId: report.checkId,
    actionCount: report.actionCount,
    issueCount: report.issueCount,
    issues: report.issues,
  }, null, 2));
  if (!process.argv.includes("--report") && report.issueCount > 0) process.exit(1);
}
