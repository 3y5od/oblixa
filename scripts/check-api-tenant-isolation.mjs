#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const API_ROOT_REL = path.join("src", "app", "api");

const TENANT_ROUTE_SEGMENTS = [
  "contracts",
  "approvals",
  "renewals",
  "obligations",
  "exceptions",
  "evidence",
  "findings",
  "scorecards",
  "assurance",
  "campaigns",
  "simulations",
  "segments",
  "decisions",
  "review-boards",
  "report-packs",
  "import",
  "export",
  "autopilot",
  "integrations",
  "command-palette",
];

const TENANT_TABLE_NAMES = [
  "contracts",
  "contract_approvals",
  "approvals",
  "renewals",
  "obligations",
  "exceptions",
  "evidence_records",
  "evidence_requests",
  "evidence_submissions",
  "evidence_requirements",
  "findings",
  "assurance_findings",
  "scorecards",
  "assurance_scorecards",
  "campaigns",
  "simulations",
  "segments",
  "decisions",
  "review_boards",
  "review_board_runs",
  "report_packs",
  "report_pack_runs",
  "import_jobs",
  "export_jobs",
  "contract_import_jobs",
  "contract_export_jobs",
  "autopilot_rules",
  "autopilot_runs",
  "autopilot_run_logs",
  "integration_settings",
  "provider_accounts",
  "v10_command_search_index",
];

const JOB_TABLE_NAMES = new Set([
  "import_jobs",
  "export_jobs",
  "contract_import_jobs",
  "contract_export_jobs",
  "autopilot_runs",
  "autopilot_run_logs",
  "review_board_runs",
  "report_pack_runs",
]);

const ORG_SCOPE_SIGNAL_RE = /\b(?:orgId|organizationId)\b|\bmembership\.organization_id\b|\bctx\.orgId\b|\borganization_id\b|\brequireV\d+Context\b|\bgetApiAuthContext\b|\bgetDeterministicMembership\b|\brequireApiWorkspaceEligibility\b/;
const ORG_PREDICATE_RE = /\.(?:eq|in)\(\s*["']organization_id["']|\.match\(\s*\{[^}]*organization_id|\.filter\(\s*["']organization_id["']|applyV10CommandSearchVisibility\s*\(/;
const USER_ID_PREDICATE_RE = /\.eq\(\s*["'](?:id|[a-z_]+_id|job_id)["']/;
const WRITE_RE = /\.(?:update|delete)\s*\(/;
const READ_RE = /\.select\s*\(/;
const SINGLE_RE = /\.(?:single|maybeSingle)\s*\(/;
const SIGNED_TOKEN_BINDING_RE = /\btokenHash\b|external_token_hash|secureCompareUtf8|validateV10ExternalEvidenceSubmission|getV10ExternalLinkState/;
const LIST_OPERATION_RE = /\.(?:order|range|limit|gt|gte|lt|lte)\s*\(/g;
const JOB_ID_PREDICATE_RE = /\.eq\(\s*["'](?:id|job_id|run_id)["']/;
const SYSTEM_TENANT_FANOUT_RE = /\bwithCronRoute\s*\(/;
const SELECTS_ORG_ID_RE = /\.select\(\s*["'][^"']*\borganization_id\b/;

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) walkRoutes(abs, acc);
    else if (name === "route.ts") acc.push(abs);
  }
  return acc;
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function routePathFromRel(rel) {
  const dir = toPosix(path.dirname(rel));
  return `/${dir === "." ? "" : dir}`;
}

function hasTenantRouteSegment(rel) {
  const routePath = routePathFromRel(rel);
  return TENANT_ROUTE_SEGMENTS.some((segment) => routePath.split("/").includes(segment));
}

function tenantTablePattern() {
  return new RegExp(`\\.from\\(\\s*["'](${TENANT_TABLE_NAMES.join("|")})["']\\s*\\)`, "g");
}

function statementFrom(text, start) {
  const rest = text.slice(start);
  const semi = rest.indexOf(";");
  return semi === -1 ? rest.slice(0, 1600) : rest.slice(0, semi + 1);
}

export function findTenantQueryStatements(text) {
  const statements = [];
  const re = tenantTablePattern();
  let match;
  while ((match = re.exec(text))) {
    statements.push({ table: match[1], statement: statementFrom(text, match.index) });
  }
  return statements;
}

function firstMatchIndex(re, text) {
  re.lastIndex = 0;
  const match = re.exec(text);
  return match ? match.index : -1;
}

function hasListOperationBeforeOrgPredicate(statement) {
  const orgPredicateIndex = firstMatchIndex(ORG_PREDICATE_RE, statement);
  if (orgPredicateIndex === -1) return false;
  LIST_OPERATION_RE.lastIndex = 0;
  let match;
  while ((match = LIST_OPERATION_RE.exec(statement))) {
    if (match.index < orgPredicateIndex) return true;
  }
  return false;
}

export function analyzeTenantIsolationRoute(rel, text) {
  const issues = [];
  const normalizedRel = toPosix(rel);
  const routeIsTenantScoped = hasTenantRouteSegment(normalizedRel);
  const statements = findTenantQueryStatements(text);
  if (!routeIsTenantScoped && statements.length === 0) return issues;

  const hasOrgScopeSignal = ORG_SCOPE_SIGNAL_RE.test(text);
  const isSystemTenantFanout = SYSTEM_TENANT_FANOUT_RE.test(text);
  if (routeIsTenantScoped && /\[.+?\]/.test(normalizedRel) && !hasOrgScopeSignal) {
    issues.push({ issue: "dynamic_tenant_route_without_org_scope_signal", rel: normalizedRel });
  }

  for (const { table, statement } of statements) {
    const hasOrgPredicate =
      ORG_PREDICATE_RE.test(statement) ||
      (table === "v10_command_search_index" && /\bapplyV10CommandSearchVisibility\s*\(/.test(text));
    const hasUserControlledIdPredicate = USER_ID_PREDICATE_RE.test(statement);
    const hasRead = READ_RE.test(statement);
    const hasWrite = WRITE_RE.test(statement);
    const returnsSingle = SINGLE_RE.test(statement);
    const hasSignedTokenBinding = SIGNED_TOKEN_BINDING_RE.test(text) && /token|external|evidence/.test(normalizedRel);
    const isOrgEnumeratingSystemScan =
      isSystemTenantFanout && hasRead && !hasWrite && SELECTS_ORG_ID_RE.test(statement);

    if ((hasRead || hasWrite) && !hasOrgScopeSignal) {
      issues.push({ issue: "tenant_table_query_without_org_scope_signal", rel: normalizedRel, table });
    }

    if (hasWrite && !hasOrgPredicate && hasUserControlledIdPredicate) {
      issues.push({ issue: "tenant_mutation_without_org_predicate", rel: normalizedRel, table });
    }

    if (returnsSingle && hasUserControlledIdPredicate && !hasOrgPredicate && !hasSignedTokenBinding) {
      issues.push({ issue: "tenant_detail_lookup_without_org_predicate", rel: normalizedRel, table });
    }

    if (hasRead && !returnsSingle && hasListOperationBeforeOrgPredicate(statement)) {
      issues.push({ issue: "tenant_list_operation_before_org_predicate", rel: normalizedRel, table });
    }

    if (hasRead && !returnsSingle && !hasOrgPredicate && !isOrgEnumeratingSystemScan && LIST_OPERATION_RE.test(statement)) {
      issues.push({ issue: "tenant_list_query_without_org_predicate", rel: normalizedRel, table });
    }

    if (JOB_TABLE_NAMES.has(table) && (hasRead || hasWrite) && JOB_ID_PREDICATE_RE.test(statement) && !hasOrgPredicate) {
      issues.push({ issue: "background_job_lookup_without_org_predicate", rel: normalizedRel, table });
    }
  }

  return issues;
}

export function analyzeApiTenantIsolation(root = ROOT) {
  const apiRoot = path.join(root, API_ROOT_REL);
  const routes = walkRoutes(apiRoot).sort();
  const issues = [];

  for (const abs of routes) {
    const rel = toPosix(path.relative(apiRoot, abs));
    const text = fs.readFileSync(abs, "utf8");
    issues.push(...analyzeTenantIsolationRoute(rel, text));
  }

  return {
    checkId: "api-tenant-isolation",
    ok: issues.length === 0,
    routeCount: routes.length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeApiTenantIsolation(ROOT);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
