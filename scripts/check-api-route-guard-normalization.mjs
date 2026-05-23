#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const API_ROOT_REL = path.join("src", "app", "api");
const BASELINE_REL = path.join("artifacts", "api-route-guard-normalization-baseline.json");
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const AUTH_GUARD_RE = /\bgetApiAuthContext\b|\bgetAuthContext\b|\brequireSessionApiContext\b|\brequireV\d+Context\b|\.auth\.getUser\s*\(|\brequireBearerSecret\b|\brequireCronAuthorized\b|\bauthorizeCronRequest\b|\bensureCronAuthorized\b|\bgateCronRequest\b/;
const MEMBERSHIP_ORG_RESOLUTION_RE = /\bgetApiAuthContext\b|\brequireSessionApiContext\b|\brequireV\d+Context\b|\bgetDeterministicMembership\b|\bgetMembership\b|\bfindMembership\b/;
const USER_CONTROLLED_ID_RE = /\bawait\s+params\b|\(await\s+params\)\.[A-Za-z0-9_]*id\b|\bsearchParams\.get\s*\(\s*["'][^"']*(?:id|Id|_id)["']\s*\)/;
const ROLE_OR_CAPABILITY_GUARD_RE = /\bcanManageCapability\s*\(|\bcanEditContracts\s*\(|\brequireV\d+Context\s*\(\s*["'][^"']+["']|\brequire(?:Role|Capability)\b/;
const WORKSPACE_ELIGIBILITY_RE = /\brequireApiWorkspaceEligibility\s*\(/;
const RATE_LIMIT_RE = /\brateLimitCheck\s*\(/;
const BODY_PARSE_RE = /\brequest\.(?:json|text|formData)\s*\(|\breadJsonBodyLimited\b|\bparseJsonBodyWithLimit\b|\breadRequestBodyLimited\b|\breadTextBodyLimited\b|\brejectUnexpectedBody\b/;
const DB_OPERATION_RE = /\.from\s*\(|\.rpc\s*\(|\bgetDeterministicMembership\b|\bgetMembership\b|\bfindMembership\b/;
const DB_MUTATION_RE = /\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/;
const EXPENSIVE_WORK_RE = /\bfetch\s*\(|\.from\s*\(|\.rpc\s*\(|\benqueue\b|\bqueue\b|\bexport[A-Z][A-Za-z0-9_]*\s*\(|\bgenerate[A-Z][A-Za-z0-9_]*\s*\(|\brun[A-Z][A-Za-z0-9_]*\s*\(/;
const FEATURE_SPECIFIC_WORK_RE = /\bsyncCampaignContractsFromEligibility\s*\(|\brunExtractionPipeline\s*\(|\bstartExtractionJob\s*\(|\brunContractCsvImport\s*\(|\bbuildOrganizationCalendarIcs\s*\(|\bsendSlack[A-Za-z0-9_]*\s*\(|\bbuildSimulationTypeSpecificSignals\s*\(|\bupsertDetectedExceptions\s*\(|\bexecuteV10(?:Audited|Idempotent)[A-Za-z0-9_]*Mutation\s*\(|\bcreateContractExportJob\s*\(/;
const RAW_SIGNATURE_RE = /stripe-signature|constructEvent|verifyWebhook|webhook.*signature/i;

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

export function extractExportedHandlers(source) {
  const handlers = [];
  const patterns = [
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    /export\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*async\b/g,
  ];
  for (const re of patterns) {
    for (const match of source.matchAll(re)) {
      const start = match.index ?? -1;
      if (start < 0) continue;
      const openBraceIdx = source.indexOf("{", start);
      const block = extractBracedBlock(source, openBraceIdx);
      if (block) handlers.push({ method: match[1], block });
    }
  }
  return handlers.sort((a, b) => a.method.localeCompare(b.method));
}

function firstIndex(source, re) {
  const match = source.match(re);
  return match?.index ?? -1;
}

function pushIfBefore(issues, rel, method, earlierName, earlierIdx, laterName, laterIdx) {
  if (earlierIdx >= 0 && laterIdx >= 0 && earlierIdx < laterIdx) {
    issues.push({ issue: `${earlierName}_before_${laterName}`, rel, method });
  }
}

export function analyzeApiRouteGuardNormalization(root = ROOT) {
  const apiRoot = path.join(root, API_ROOT_REL);
  const issues = [];
  const routes = walkRoutes(apiRoot).sort();

  for (const abs of routes) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    const signedRawBodyRoute = RAW_SIGNATURE_RE.test(source);
    for (const handler of extractExportedHandlers(source)) {
      const authIdx = firstIndex(handler.block, AUTH_GUARD_RE);
      const membershipOrgIdx = firstIndex(handler.block, MEMBERSHIP_ORG_RESOLUTION_RE);
      const userControlledIdIdx = firstIndex(handler.block, USER_CONTROLLED_ID_RE);
      const roleOrCapabilityIdx = firstIndex(handler.block, ROLE_OR_CAPABILITY_GUARD_RE);
      const workspaceEligibilityIdx = firstIndex(handler.block, WORKSPACE_ELIGIBILITY_RE);
      const rateLimitIdx = firstIndex(handler.block, RATE_LIMIT_RE);
      const bodyIdx = firstIndex(handler.block, BODY_PARSE_RE);
      const dbOperationIdx = firstIndex(handler.block, DB_OPERATION_RE);
      const dbMutationIdx = firstIndex(handler.block, DB_MUTATION_RE);
      const expensiveIdx = firstIndex(handler.block, EXPENSIVE_WORK_RE);
      const featureSpecificWorkIdx = firstIndex(handler.block, FEATURE_SPECIFIC_WORK_RE);

      if (MUTATING_METHODS.has(handler.method)) {
        pushIfBefore(issues, rel, handler.method, "db_operation", dbOperationIdx, "auth_guard", authIdx);
        pushIfBefore(issues, rel, handler.method, "db_mutation", dbMutationIdx, "auth_guard", authIdx);
        pushIfBefore(issues, rel, handler.method, "db_mutation", dbMutationIdx, "rate_limit", rateLimitIdx);
      }
      pushIfBefore(
        issues,
        rel,
        handler.method,
        "user_controlled_id",
        userControlledIdIdx,
        "membership_or_org_resolution",
        membershipOrgIdx
      );
      pushIfBefore(
        issues,
        rel,
        handler.method,
        "workspace_eligibility",
        workspaceEligibilityIdx,
        "role_or_capability_guard",
        roleOrCapabilityIdx
      );
      pushIfBefore(
        issues,
        rel,
        handler.method,
        "feature_specific_work",
        featureSpecificWorkIdx,
        "role_or_capability_guard",
        roleOrCapabilityIdx
      );
      pushIfBefore(
        issues,
        rel,
        handler.method,
        "feature_specific_work",
        featureSpecificWorkIdx,
        "workspace_eligibility",
        workspaceEligibilityIdx
      );
      pushIfBefore(issues, rel, handler.method, "expensive_work", expensiveIdx, "rate_limit", rateLimitIdx);
      if (!signedRawBodyRoute) {
        pushIfBefore(issues, rel, handler.method, "body_parse", bodyIdx, "auth_guard", authIdx);
        pushIfBefore(issues, rel, handler.method, "body_parse", bodyIdx, "rate_limit", rateLimitIdx);
      }
    }
  }

  return {
    checkId: "api-route-guard-normalization",
    ok: issues.length === 0,
    routeCount: routes.length,
    issueCount: issues.length,
    issues,
  };
}

function issueKey(issue) {
  return `${issue.rel}:${issue.method}:${issue.issue}`;
}

function readBaseline(root) {
  const file = path.join(root, BASELINE_REL);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return new Set((Array.isArray(parsed.issues) ? parsed.issues : []).map(issueKey));
}

export function analyzeApiRouteGuardNormalizationRatchet(root = ROOT) {
  const report = analyzeApiRouteGuardNormalization(root);
  const baseline = readBaseline(root);
  const baselineMissing = !baseline;
  const newIssues = baseline ? report.issues.filter((issue) => !baseline.has(issueKey(issue))) : report.issues;
  return {
    ...report,
    ok: !baselineMissing && newIssues.length === 0,
    baselineMissing,
    newIssueCount: newIssues.length,
    newIssues,
  };
}

function writeBaseline(root, report) {
  const file = path.join(root, BASELINE_REL);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        checkId: report.checkId,
        routeCount: report.routeCount,
        issueCount: report.issueCount,
        issues: report.issues,
      },
      null,
      2
    )}\n`
  );
  return file;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--write-baseline")) {
    const report = analyzeApiRouteGuardNormalization();
    const file = writeBaseline(ROOT, report);
    console.log(`Wrote ${file} (${report.issueCount} baseline issues)`);
    process.exit(0);
  }
  const report = analyzeApiRouteGuardNormalizationRatchet();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
