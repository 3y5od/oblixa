#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC_ROOT_REL = "src";

const VALID_ROLES = new Set([
  "admin",
  "editor",
  "viewer",
  "ops_manager",
  "legal_reviewer",
  "finance_reviewer",
  "manager",
]);

const VALID_CAPABILITIES = new Set([
  "contracts_edit",
  "approvals_manage",
  "renewals_manage",
  "maintenance_manage",
  "settings_manage",
]);

const AUTHZ_CALL_PATTERNS = [
  { kind: "role_lookup", re: /\bgetOrgMemberRole\s*\(/g },
  { kind: "legacy_contract_edit", re: /\bcanEditContracts\s*\(/g },
  { kind: "capability_check", re: /\bhasRoleCapability\s*\(/g },
  { kind: "api_capability_check", re: /\bcanManageCapability\s*\(/g },
  { kind: "org_capability_check", re: /\bhasOrgCapability\s*\(/g },
  { kind: "role_floor_check", re: /\brequireRoleAtLeast\s*\(/g },
];

const ROLE_PROPERTY_LITERAL_RE = /\brole\s*:\s*["']([^"']+)["']/g;
const CAPABILITY_PROPERTY_LITERAL_RE = /\bcapability\s*:\s*["']([^"']+)["']/g;
const ROLE_CAPABILITY_OBJECT_CALL_RE = /\bhasRoleCapability\s*\(/g;
const ORG_CAPABILITY_OBJECT_CALL_RE = /\bhasOrgCapability\s*\(/g;
const REQUIRE_ROLE_LITERAL_RE = /\brequireRoleAtLeast\s*\([^,]+,\s*["']([^"']+)["']/g;
const CAN_EDIT_ROLE_LITERAL_RE = /\bcanEditContracts\s*\(\s*["']([^"']+)["']/g;
const CAPABILITY_ARG_LITERAL_RE = /\b(?:canManageCapability)\s*\([^,]+,\s*["']([^"']+)["']/g;
const TEST_REQUIRED_MARKERS = [
  { rel: "src/lib/access-control.test.ts", marker: "exhaustive baseline matrix", issue: "missing_exhaustive_role_capability_matrix_test" },
  { rel: "src/lib/access-control.test.ts", marker: "allows role-policy overrides", issue: "missing_role_policy_grant_test" },
  { rel: "src/lib/access-control.test.ts", marker: "override false revokes", issue: "missing_role_policy_revocation_test" },
  { rel: "src/lib/access-control.test.ts", marker: "unknown roles never grant", issue: "missing_unknown_role_capability_denial_test" },
  { rel: "src/lib/permissions.test.ts", marker: "unsupported roles", issue: "missing_unsupported_can_edit_contracts_denial_test" },
  { rel: "src/lib/security/api-guards.test.ts", marker: "unsupported roles", issue: "missing_unsupported_role_floor_denial_test" },
  { rel: "src/lib/access-control.test.ts", marker: "viewer has no baseline mutation capabilities", issue: "missing_viewer_mutation_denial_matrix_test" },
  { rel: "scripts/check-role-capability-inventory.test.mjs", marker: "rejects settings mutations without settings_manage", issue: "missing_settings_manage_static_test" },
  { rel: "scripts/check-role-capability-inventory.test.mjs", marker: "rejects automation execution without manage capability", issue: "missing_automation_capability_static_test" },
  { rel: "scripts/check-role-capability-inventory.test.mjs", marker: "rejects export routes without nearest export capability", issue: "missing_export_capability_static_test" },
  { rel: "scripts/check-role-capability-inventory.test.mjs", marker: "rejects assurance mutations without manage capability", issue: "missing_assurance_capability_static_test" },
  { rel: "scripts/check-role-capability-inventory.test.mjs", marker: "rejects user integration mutations without capability gate", issue: "missing_integration_capability_static_test" },
  { rel: "scripts/check-role-capability-inventory.test.mjs", marker: "requires route-level lowest-privilege denial tests for sensitive mutations", issue: "missing_sensitive_route_denial_coverage_static_test" },
];

const MUTATING_METHOD_RE = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b|export\s+const\s+(?:POST|PUT|PATCH|DELETE)\s*=/;
const SETTINGS_SURFACE_RE = /src\/app\/api\/(?:workspace\/v6-settings|segments(?:\/|$)|autopilot\/rules(?:\/|$)|autopilot\/run-logs\/)/;
const AUTOMATION_SURFACE_RE = /src\/app\/api\/(?:autopilot|campaigns|maintenance|review-boards|control-policies|policy\/simulate|programs|simulations)/;
const EXPORT_SURFACE_RE = /src\/app\/api\/(?:export\/|campaigns\/.*\/export\/|report-packs\/)/;
const ASSURANCE_SURFACE_RE = /src\/app\/api\/assurance\//;
const INTEGRATION_USER_MUTATION_RE = /src\/app\/api\/integrations\/(?:oauth\/start|slack\/renewal-summary)\//;
const PUBLIC_EXPORT_SCOPE_RE = /\/\[token\]\/route\.ts$|calendar\/feed\/\[token\]\/route\.ts$/;
const SETTINGS_CAPABILITY_RE = /["']settings_manage["']|requireRoleAtLeast\s*\([^,]+,\s*["']admin["']/;
const AUTOMATION_CAPABILITY_RE = /["'](?:settings_manage|maintenance_manage|contracts_edit)["']|canEditContracts\s*\(/;
const EXPORT_CAPABILITY_RE = /["'](?:contracts_edit|maintenance_manage)["']|canEditContracts\s*\(|getDeterministicMembership\s*\(|organization_members|requireApiWorkspaceEligibility\s*\(|getApiAuthContext\s*\(/;
const ASSURANCE_CAPABILITY_RE = /["'](?:maintenance_manage|settings_manage)["']|requireRoleAtLeast\s*\([^,]+,\s*["']admin["']/;
const INTEGRATION_CAPABILITY_RE = /canManageCapability\s*\(|requireRoleAtLeast\s*\([^,]+,\s*["']admin["']|getDeterministicMembership\s*\([^)]*\)[\s\S]{0,600}\.role\s*!==\s*["']admin["']/;
const LOWEST_PRIVILEGE_DENIAL_TEST_RE = /without (?:capability|settings_manage|maintenance_manage|contracts_edit)|viewer|lowest-privilege|low privilege|lacks [a-z_]+ capability|returns 403|toBe\(403\)|Access denied|admin_required/;

function walkSource(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkSource(p, acc);
    else if ((name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function extractStatement(source, index) {
  const tail = source.slice(index);
  const semicolon = tail.indexOf(";");
  return semicolon >= 0 ? tail.slice(0, semicolon + 1) : tail.slice(0, 800);
}

function collectAuthzCalls(root) {
  const srcRoot = path.join(root, SRC_ROOT_REL);
  const files = walkSource(srcRoot).sort();
  const calls = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (/\.(test|spec)\.tsx?$/.test(rel)) continue;
    const source = fs.readFileSync(abs, "utf8");
    for (const pattern of AUTHZ_CALL_PATTERNS) {
      for (const match of source.matchAll(pattern.re)) {
        calls.push({ rel, line: lineNumber(source, match.index ?? 0), kind: pattern.kind });
      }
    }
  }
  return calls;
}

function findUnknownLiteralIssues(root) {
  const issues = [];
  const srcRoot = path.join(root, SRC_ROOT_REL);
  for (const abs of walkSource(srcRoot).sort()) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (/\.(test|spec)\.tsx?$/.test(rel)) continue;
    const source = fs.readFileSync(abs, "utf8");
    for (const re of [REQUIRE_ROLE_LITERAL_RE, CAN_EDIT_ROLE_LITERAL_RE]) {
      for (const match of source.matchAll(re)) {
        const value = match[1];
        if (!VALID_ROLES.has(value)) issues.push({ issue: "unknown_role_literal", rel, line: lineNumber(source, match.index ?? 0), value });
      }
    }
    for (const call of source.matchAll(ROLE_CAPABILITY_OBJECT_CALL_RE)) {
      const statement = extractStatement(source, call.index ?? 0);
      for (const match of statement.matchAll(ROLE_PROPERTY_LITERAL_RE)) {
        const value = match[1];
        if (!VALID_ROLES.has(value)) issues.push({ issue: "unknown_role_literal", rel, line: lineNumber(source, call.index ?? 0), value });
      }
      for (const match of statement.matchAll(CAPABILITY_PROPERTY_LITERAL_RE)) {
        const value = match[1];
        if (!VALID_CAPABILITIES.has(value)) issues.push({ issue: "unknown_capability_literal", rel, line: lineNumber(source, call.index ?? 0), value });
      }
    }
    for (const call of source.matchAll(ORG_CAPABILITY_OBJECT_CALL_RE)) {
      const statement = extractStatement(source, call.index ?? 0);
      for (const match of statement.matchAll(CAPABILITY_PROPERTY_LITERAL_RE)) {
        const value = match[1];
        if (!VALID_CAPABILITIES.has(value)) issues.push({ issue: "unknown_capability_literal", rel, line: lineNumber(source, call.index ?? 0), value });
      }
    }
    for (const re of [CAPABILITY_ARG_LITERAL_RE]) {
      for (const match of source.matchAll(re)) {
        const value = match[1];
        if (!VALID_CAPABILITIES.has(value)) issues.push({ issue: "unknown_capability_literal", rel, line: lineNumber(source, match.index ?? 0), value });
      }
    }
  }
  return issues;
}

function findRequiredTestIssues(root) {
  const issues = [];
  for (const requirement of TEST_REQUIRED_MARKERS) {
    const abs = path.join(root, requirement.rel);
    if (!fs.existsSync(abs) || !fs.readFileSync(abs, "utf8").includes(requirement.marker)) {
      issues.push({ issue: requirement.issue, rel: requirement.rel });
    }
  }
  return issues;
}

function findSensitiveSurfaceIssues(root) {
  const issues = [];
  const apiRoot = path.join(root, "src", "app", "api");
  for (const abs of walkSource(apiRoot).sort()) {
    if (path.basename(abs) !== "route.ts") continue;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    if (MUTATING_METHOD_RE.test(source) && SETTINGS_SURFACE_RE.test(rel) && !SETTINGS_CAPABILITY_RE.test(source)) {
      issues.push({ issue: "settings_mutation_without_settings_manage", rel });
    }
    if (MUTATING_METHOD_RE.test(source) && AUTOMATION_SURFACE_RE.test(rel) && !AUTOMATION_CAPABILITY_RE.test(source)) {
      issues.push({ issue: "automation_mutation_without_manage_capability", rel });
    }
    if (EXPORT_SURFACE_RE.test(rel) && !PUBLIC_EXPORT_SCOPE_RE.test(rel) && !EXPORT_CAPABILITY_RE.test(source)) {
      issues.push({ issue: "export_route_without_nearest_capability", rel });
    }
    if (MUTATING_METHOD_RE.test(source) && ASSURANCE_SURFACE_RE.test(rel) && !ASSURANCE_CAPABILITY_RE.test(source)) {
      issues.push({ issue: "assurance_mutation_without_manage_capability", rel });
    }
    if (MUTATING_METHOD_RE.test(source) && INTEGRATION_USER_MUTATION_RE.test(rel) && !INTEGRATION_CAPABILITY_RE.test(source)) {
      issues.push({ issue: "integration_mutation_without_capability_gate", rel });
    }
  }
  return issues;
}

function isSensitiveMutatingRoute(rel, source) {
  if (!MUTATING_METHOD_RE.test(source)) return false;
  return (
    SETTINGS_SURFACE_RE.test(rel) ||
    AUTOMATION_SURFACE_RE.test(rel) ||
    ASSURANCE_SURFACE_RE.test(rel) ||
    INTEGRATION_USER_MUTATION_RE.test(rel) ||
    (EXPORT_SURFACE_RE.test(rel) && !PUBLIC_EXPORT_SCOPE_RE.test(rel))
  );
}

function routeTestCandidates(abs) {
  const dir = path.dirname(abs);
  return [
    path.join(dir, "route.test.ts"),
    path.join(dir, "route.test.tsx"),
    path.join(path.dirname(dir), `${path.basename(dir)}.test.ts`),
  ];
}

function hasStaticLowestPrivilegeDenialCoverage(rel, source) {
  return (
    (SETTINGS_SURFACE_RE.test(rel) && SETTINGS_CAPABILITY_RE.test(source)) ||
    (AUTOMATION_SURFACE_RE.test(rel) && AUTOMATION_CAPABILITY_RE.test(source)) ||
    (EXPORT_SURFACE_RE.test(rel) && !PUBLIC_EXPORT_SCOPE_RE.test(rel) && EXPORT_CAPABILITY_RE.test(source)) ||
    (ASSURANCE_SURFACE_RE.test(rel) && ASSURANCE_CAPABILITY_RE.test(source)) ||
    (INTEGRATION_USER_MUTATION_RE.test(rel) && INTEGRATION_CAPABILITY_RE.test(source))
  );
}

function hasLowestPrivilegeDenialCoverage(rel, source, routeAbs) {
  if (hasStaticLowestPrivilegeDenialCoverage(rel, source)) return true;
  return routeTestCandidates(routeAbs).some((testAbs) => {
    if (!fs.existsSync(testAbs)) return false;
    return LOWEST_PRIVILEGE_DENIAL_TEST_RE.test(fs.readFileSync(testAbs, "utf8"));
  });
}

function findSensitiveRouteDenialCoverageIssues(root) {
  const issues = [];
  const apiRoot = path.join(root, "src", "app", "api");
  for (const abs of walkSource(apiRoot).sort()) {
    if (path.basename(abs) !== "route.ts") continue;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    if (!isSensitiveMutatingRoute(rel, source)) continue;
    if (!hasLowestPrivilegeDenialCoverage(rel, source, abs)) {
      issues.push({ issue: "sensitive_route_missing_lowest_privilege_denial_test", rel });
    }
  }
  return issues;
}

export function analyzeRoleCapabilityInventory(root = ROOT) {
  const calls = collectAuthzCalls(root);
  const byKind = calls.reduce((acc, call) => {
    acc[call.kind] = (acc[call.kind] ?? 0) + 1;
    return acc;
  }, {});
  const issues = [];
  if (calls.length === 0) issues.push({ issue: "missing_role_capability_inventory" });
  issues.push(...findUnknownLiteralIssues(root));
  issues.push(...findRequiredTestIssues(root));
  issues.push(...findSensitiveSurfaceIssues(root));
  issues.push(...findSensitiveRouteDenialCoverageIssues(root));
  return {
    checkId: "role-capability-inventory",
    ok: issues.length === 0,
    callCount: calls.length,
    byKind,
    calls,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRoleCapabilityInventory();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
