#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildRouteUniversePayload, HTTP_METHODS } from "./lib/build-route-universe.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.join(__dirname, "..");
const TARGET_METHODS = HTTP_METHODS;
const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const AUTH_TYPES = new Set([
  "session",
  "cron_secret",
  "bearer_secret",
  "provider_signature",
  "public_token",
  "anonymous_public_read",
  "explicitly_exempt",
]);

export const SECURITY_ROUTE_MATRIX_REQUIRED_FIELDS = [
  "path",
  "method",
  "route_file",
  "auth_type",
  "required_role_or_capability",
  "org_scope_source",
  "workspace_eligibility_gate",
  "rate_limit_policy",
  "rate_limit_key_shape",
  "body_size_policy",
  "csrf_origin_policy",
  "idempotency_or_job_lock_policy",
  "audit_event_expectation",
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

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

function toApiPath(apiRoot, abs) {
  const rel = path.relative(apiRoot, abs).replace(/\\/g, "/");
  const segs = rel.split("/").filter(Boolean);
  segs.pop();
  return `/${["api", ...segs].join("/")}`;
}

function methodsFromSource(source) {
  return TARGET_METHODS.filter((method) => {
    const functionExport = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
    const constExport = new RegExp(`export\\s+const\\s+${method}\\s*=`);
    return functionExport.test(source) || constExport.test(source);
  });
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

function handlerBlockFromSource(source, method) {
  const patterns = [
    new RegExp(`export\\s+async\\s+function\\s+${method}\\b`),
    new RegExp(`export\\s+function\\s+${method}\\b`),
    new RegExp(`export\\s+const\\s+${method}\\s*=\\s*async\\b`),
  ];
  for (const re of patterns) {
    const match = re.exec(source);
    if (!match) continue;
    const openParenIdx = source.indexOf("(", match.index);
    let openBraceIdx = -1;
    if (openParenIdx >= 0) {
      let depth = 0;
      for (let i = openParenIdx; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === "(") depth += 1;
        else if (ch === ")") {
          depth -= 1;
          if (depth === 0) {
            openBraceIdx = source.indexOf("{", i);
            break;
          }
        }
      }
    }
    if (openBraceIdx < 0) {
      const arrowIdx = source.indexOf("=>", match.index);
      openBraceIdx = source.indexOf("{", arrowIdx >= 0 ? arrowIdx : match.index);
    }
    return extractBracedBlock(source, openBraceIdx) ?? source.slice(match.index);
  }
  return source;
}

function loadPublicAllowlist(root) {
  const file = path.join(root, "scripts", "api-route-public-allowlist.txt");
  return new Set(
    read(file)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.replace(/\\/g, "/"))
  );
}

function loadCronPaths(root) {
  try {
    const parsed = JSON.parse(read(path.join(root, "vercel.json")) || "{}");
    return new Set(
      (Array.isArray(parsed.crons) ? parsed.crons : [])
        .map((entry) => String(entry?.path ?? ""))
        .filter((entry) => entry.startsWith("/api/"))
    );
  } catch {
    return new Set();
  }
}

function apiRouteUniverseRows(root) {
  return buildRouteUniversePayload(root).universe.routes.filter((row) => row.kind === "api_route");
}

function hasGlobalBrowserOriginPolicy(root) {
  const proxy = read(path.join(root, "src", "proxy.ts"));
  return (
    proxy.includes("requiresBrowserOriginPolicy(request, pathname)") &&
    proxy.includes("secFetchSiteAllowsSensitiveMutation(request)") &&
    proxy.includes('code: "cross_site_request_rejected"')
  );
}

function hasGlobalWorkspaceApiRateLimit(root) {
  const guard = read(path.join(root, "src", "lib", "product-surface", "api-workspace-guard.ts"));
  return (
    guard.includes("rateLimitCheck(`workspace-api:${input.orgId}:${input.apiPath}`") &&
    guard.includes("RATE_LIMITS.workspaceApi") &&
    guard.includes("jsonRateLimited(rate.retryAfterMs, input.apiPath)")
  );
}

function routeRel(root, abs) {
  return path.relative(root, abs).replace(/\\/g, "/");
}

function classifyAuthType({ path: routePath, routeFile, source, method, cronPaths, publicAllowlist }) {
  if (cronPaths.has(routePath) || routePath.includes("/api/cron/")) return "cron_secret";
  if (/stripe-signature|constructEvent|verifyWebhook|webhook.*signature/i.test(source) || routePath.includes("/stripe/webhook") || routePath.includes("/webhooks/")) {
    return "provider_signature";
  }
  if (/\bisInboundAutomationAuthorized\b|\binboundOrgNotAllowedResponse\b/i.test(source)) return "bearer_secret";
  if (/\brequireBearerSecret\b|\bx-api-key\b|\bEXTRACTION_WORKER_SECRET\b|\bparseBearerToken\b/i.test(source) || routePath.startsWith("/api/internal/")) {
    return "bearer_secret";
  }
  if (routePath.includes("/external-actions/") || routePath.includes("[token]")) return "public_token";
  if (publicAllowlist.has(routeFile)) return "explicitly_exempt";
  if (method === "GET" && (routePath.endsWith("/health") || routePath.includes("/reports/track/"))) return "anonymous_public_read";
  if (routePath.includes("/auth/") || /unauthenticatedAccessAllowed|publicAllowlist/i.test(source)) return "explicitly_exempt";
  return "session";
}

function requiredRoleOrCapability(authType, method, routePath, source) {
  if (authType !== "session") return "not_applicable";
  if (/\b(settings_manage|maintenance_manage|admin|product_settings)\b/i.test(source) || routePath.includes("/settings/")) {
    return "admin_or_settings_manage";
  }
  if (/\b(canManageCapability|capability|manage|approve|reject|resolve|publish|revert)\b/i.test(source)) {
    return "route_capability_or_manager";
  }
  if (MUTATING_METHODS.has(method)) return "editor_manager_or_admin";
  return "viewer_or_higher";
}

function orgScopeSource(authType, routePath, source) {
  if (authType === "session") return "session_membership";
  if (authType === "public_token") return "signed_token_binding";
  if (authType === "provider_signature") return "provider_account_binding";
  if (authType === "cron_secret") return /\bjobId\b|\bjob_id\b|\bjob\b/i.test(source) ? "job_row" : "route_specific_invariant";
  if (authType === "bearer_secret") return routePath.startsWith("/api/internal/") ? "route_specific_invariant" : "signed_token_binding";
  return "none_required";
}

function workspaceEligibilityGate(routePath, source) {
  if (/\brequireApiWorkspaceEligibility\b/.test(source)) return "requireApiWorkspaceEligibility";
  if (/assurance|autopilot|campaign|intelligence|simulation|review-board/i.test(routePath)) return "governed_route_static_policy";
  return "not_governed";
}

function rateLimitPolicy(authType, method, source, globalWorkspaceApiRateLimit) {
  if (/\brateLimitCheck\b|\bRATE_LIMITS\b/.test(source)) return "explicit";
  if (globalWorkspaceApiRateLimit && /\brequireApiWorkspaceEligibility(?:V10)?\b/.test(source)) return "workspace_gate_explicit";
  if (authType === "cron_secret") return "cron_route_policy";
  if (authType === "provider_signature") return "provider_signature_policy";
  if (authType === "public_token") return "token_route_policy";
  if (MUTATING_METHODS.has(method)) return "mutation_required";
  return "standard_or_not_applicable";
}

function rateLimitKeyShape(authType, routePath, source, globalWorkspaceApiRateLimit) {
  if (/\borganizationId\b|\borgId\b|\borganization_id\b/.test(source) && /\buserId\b|\buser\.id\b/.test(source)) return "org_user";
  if (/\buserId\b|\buser\.id\b/.test(source) && /\bip\b|\bclientIp\b/.test(source)) return "user_ip";
  if (globalWorkspaceApiRateLimit && /\brequireApiWorkspaceEligibility(?:V10)?\b/.test(source)) return "org_route";
  if (authType === "public_token") return "token";
  if (authType === "provider_signature") return "provider_account_or_signature";
  if (authType === "cron_secret") return `cron:${routePath}`;
  if (authType === "session") return "session_user_or_org";
  return "route";
}

function bodySizePolicy(authType, method, source) {
  if (!MUTATING_METHODS.has(method)) return "no_body_expected";
  if (/\breadJsonBodyLimited(?:WithRaw)?\b|\bparseJsonBodyWithLimit\b/.test(source)) return "bounded_json";
  if (/\breadRequestBodyLimited\b|\breadTextBodyLimited\b/.test(source)) return "bounded_text";
  if (/\bgetImportCsvPayload\s*\(\s*request\b/.test(source)) return "bounded_text";
  if (/\brejectUnexpectedBody\b/.test(source)) return "no_body_rejected";
  if (/\bformData\s*\(/.test(source)) return "form_data_route_limit";
  if (authType === "provider_signature") return "signature_bound_raw_body";
  if (/\brequest\.json\s*\(/.test(source)) return "raw_json_limit_required";
  if (/\brequest\.text\s*\(/.test(source)) return "raw_text_limit_required";
  return "no_body_reader_detected";
}

function csrfOriginPolicy(authType, method, source, globalBrowserOriginPolicy) {
  if (authType !== "session" || !MUTATING_METHODS.has(method)) return "not_applicable";
  if (/Origin|origin|Referer|referrer|Sec-Fetch-Site|csrf|sameOrigin/i.test(source)) return "same_origin_or_sec_fetch_enforced";
  if (globalBrowserOriginPolicy) return "same_origin_or_sec_fetch_enforced";
  return "cookie_mutation_origin_required";
}

function idempotencyOrJobLockPolicy(method, source, routePath) {
  if (!MUTATING_METHODS.has(method) && !routePath.includes("/cron/")) return "not_applicable";
  if (/\bwithCronRoute\s*\(|\bwithV6CronRoute\s*\(|\brunCronRoute\s*\(/.test(source)) return "job_lock_or_claim";
  if (/\b(lock|claim|lease)\b|SKIP LOCKED|for update/i.test(source)) return "job_lock_or_claim";
  if (/idempotency|enforceIdempotency|dedupe|duplicate/i.test(source)) return "idempotency_or_duplicate_guard";
  if (/status\s*===\s*["'](?:submitted|closed|completed|canceled|cancelled|expired|done|approved|rejected|running)["']|\.eq\(["']status["']/.test(source)) return "terminal_state_guard";
  if (routePath.includes("/cron/")) return "cron_job_lock_required";
  return "side_effect_policy_required";
}

function auditEventExpectation(method, source, routePath) {
  if (routePath.endsWith("/health")) return "not_applicable";
  const sensitiveRead = /export|report|evidence|settings|audit|diagnostic|health|integration|token/i.test(routePath);
  if (!MUTATING_METHODS.has(method) && !sensitiveRead) return "not_applicable";
  if (/audit|recordAudit|auditEvent|writeAudit|logAudit/i.test(source)) return "explicit_audit_event";
  return "audit_event_expected";
}

function secIds(row) {
  const ids = new Set(["SEC-DOS-001"]);
  for (let i = 1; i <= 10; i += 1) ids.add(`SEC-API${i}`);
  if (row.auth_type === "session") ids.add("SEC-AZ-002");
  if (row.auth_type === "cron_secret") ids.add("SEC-AUTH-012").add("SEC-CRON-001");
  if (row.auth_type === "provider_signature") ids.add("SEC-INT-001").add("SEC-INT-003");
  if (row.workspace_eligibility_gate !== "not_governed") ids.add("SEC-AZ-003");
  return [...ids].sort();
}

export function buildSecurityRouteMatrix(root = defaultRoot) {
  const publicAllowlist = loadPublicAllowlist(root);
  const cronPaths = loadCronPaths(root);
  const globalBrowserOriginPolicy = hasGlobalBrowserOriginPolicy(root);
  const globalWorkspaceApiRateLimit = hasGlobalWorkspaceApiRateLimit(root);
  const rows = [];
  for (const universeRow of apiRouteUniverseRows(root)) {
    const routeFile = universeRow.sourcePath;
    const abs = path.join(root, routeFile);
    const source = fs.readFileSync(abs, "utf8");
    const routePath = universeRow.route;
    const methods = (universeRow.methods ?? []).filter((method) => TARGET_METHODS.includes(method));
    for (const method of methods) {
      const handlerSource = handlerBlockFromSource(source, method);
      const authType = classifyAuthType({ path: routePath, routeFile: routeFile.replace(/^src\/app\/api\//, ""), source, method, cronPaths, publicAllowlist });
      const row = {
        path: routePath,
        method,
        route_file: routeFile,
        route_universe_id: universeRow.id,
        auth_type: authType,
        required_role_or_capability: requiredRoleOrCapability(authType, method, routePath, source),
        org_scope_source: orgScopeSource(authType, routePath, source),
        workspace_eligibility_gate: workspaceEligibilityGate(routePath, source),
        rate_limit_policy: rateLimitPolicy(authType, method, source, globalWorkspaceApiRateLimit),
        rate_limit_key_shape: rateLimitKeyShape(authType, routePath, source, globalWorkspaceApiRateLimit),
        body_size_policy: bodySizePolicy(authType, method, handlerSource),
        csrf_origin_policy: csrfOriginPolicy(authType, method, source, globalBrowserOriginPolicy),
        idempotency_or_job_lock_policy: idempotencyOrJobLockPolicy(method, handlerSource, routePath),
        audit_event_expectation: auditEventExpectation(method, handlerSource, routePath),
      };
      rows.push({ ...row, sec_ids: secIds(row) });
    }
  }
  return rows;
}

export function findSecurityRouteMatrixUniverseFailures(rootDir = defaultRoot, rows) {
  const failures = [];
  const expected = new Map();
  for (const universeRow of apiRouteUniverseRows(rootDir)) {
    for (const method of universeRow.methods ?? []) {
      if (!TARGET_METHODS.includes(method)) continue;
      expected.set(`${universeRow.sourcePath}:${method}`, {
        path: universeRow.route,
        route_file: universeRow.sourcePath,
        method,
      });
    }
  }

  const actual = new Map();
  for (const row of rows) {
    const key = `${row.route_file}:${row.method}`;
    if (!expected.has(key)) {
      failures.push(`${key}:security_matrix_row_not_in_route_universe`);
      continue;
    }
    actual.set(key, row);
    const expectedRow = expected.get(key);
    if (row.path !== expectedRow.path) failures.push(`${key}:route_universe_path_mismatch:${row.path}`);
  }

  for (const key of expected.keys()) {
    if (!actual.has(key)) failures.push(`${key}:missing_security_matrix_row`);
  }

  return failures;
}

export function findSecurityRouteMatrixFailures(rows) {
  const failures = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.route_file}:${row.method}`;
    if (seen.has(key)) failures.push(`${key}:duplicate_row`);
    seen.add(key);
    for (const field of SECURITY_ROUTE_MATRIX_REQUIRED_FIELDS) {
      if (typeof row[field] !== "string" || row[field].trim() === "") failures.push(`${key}:missing_${field}`);
    }
    if (!TARGET_METHODS.includes(row.method)) failures.push(`${key}:unsupported_method`);
    if (!AUTH_TYPES.has(row.auth_type)) failures.push(`${key}:invalid_auth_type:${row.auth_type}`);
    if (row.auth_type !== "explicitly_exempt" && row.org_scope_source === "none_required" && row.required_role_or_capability === "not_applicable") {
      failures.push(`${key}:non_exempt_route_missing_scope_or_role_classification`);
    }
    if (row.csrf_origin_policy === "cookie_mutation_origin_required") {
      failures.push(`${key}:cookie_mutation_origin_required`);
    }
    if (row.rate_limit_policy === "mutation_required") {
      failures.push(`${key}:mutation_rate_limit_required`);
    }
    if (row.body_size_policy === "no_body_reader_detected") {
      failures.push(`${key}:unexpected_body_guard_required`);
    }
    if (row.idempotency_or_job_lock_policy === "cron_job_lock_required") {
      failures.push(`${key}:cron_job_lock_required`);
    }
    if (row.idempotency_or_job_lock_policy === "side_effect_policy_required") {
      failures.push(`${key}:side_effect_policy_required`);
    }
  }
  return failures;
}

function main() {
  const outPath = path.join(defaultRoot, "artifacts", "security-route-matrix.json");
  const rows = buildSecurityRouteMatrix(defaultRoot);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`Wrote ${outPath} (${rows.length} method rows)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
