#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:csrf-surface-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:csrf-surface-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:csrf-surface-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/read-json-body-limited.ts": [
    "const DEFAULT_MAX = 512 * 1024;",
    "export const BODY_LIMIT_SMALL_JSON = 32 * 1024;",
    "export const BODY_LIMIT_MEDIUM_JSON = 256 * 1024;",
    "export const BODY_LIMIT_LARGE_JSON = 1024 * 1024;",
    "export const BODY_LIMIT_STRICT_INBOUND = 256 * 1024;",
    'const len = request.headers.get("content-length");',
    "return jsonPayloadTooLarge();",
    'reason: "unsafe_json_key"',
    'reason: "json_shape_too_large"',
    "hasUnsafeJsonKey",
    "isJsonShapeWithinLimits",
    "allowJsonWhitespaceControls",
    "export async function readTextBodyLimited(",
    "export async function parseJsonBodyWithLimit<T>(",
  ],
  "src/lib/security/read-json-body-limited.test.ts": [
    'it("rejects oversized body by Content-Length"',
    'it("parses small JSON"',
    'it("returns safe 400 for invalid JSON"',
    'it("rejects oversized text body before parsing"',
    'it("maps body through parse"',
  ],
  "scripts/lib/build-route-universe.mjs": [
    "function bodyPolicy(methods, source, cls) {",
    'const mutating = methods.some((method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method));',
    'if (/readJsonBodyLimited|parseJsonBodyWithLimit|readRequestBodyLimited|readTextBodyLimited|formData\\(/.test(source)) return "bounded_or_form_body";',
    'if (/rejectUnexpectedBody/.test(source)) return "no_body_rejected";',
    'return "body_limit_required";',
  ],
  "src/app/api/programs/route.ts": [
    'const parsed = await readJsonBodyLimited(request);',
    'if (!parsed.ok) return parsed.response;',
  ],
  "src/app/api/extract/route.ts": [
    'const ctReject = jsonContentTypeRejection(request);',
    'const _limBody = await readJsonBodyLimited(request, BODY_LIMIT_LARGE_JSON);',
    'if (!_limBody.ok) return _limBody.response;',
  ],
  "src/app/api/integrations/oauth/start/route.ts": [
    'const _lb_body = await readJsonBodyLimited(request);',
    'if (!_lb_body.ok) return _lb_body.response;',
  ],
  "src/app/api/workspace/v6-settings/route.ts": [
    "BODY_LIMIT_SMALL_JSON",
    "readJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON)",
  ],
  "src/app/api/command-centers/preferences/route.ts": [
    "BODY_LIMIT_SMALL_JSON",
    "readJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON)",
  ],
  "src/app/api/autopilot/rules/route.ts": [
    "BODY_LIMIT_MEDIUM_JSON",
    "parseJsonBodyWithLimit(",
  ],
  "src/app/api/segments/route.ts": [
    "BODY_LIMIT_MEDIUM_JSON",
    "parseJsonBodyWithLimit(",
  ],
  "src/app/api/import/contracts/route.ts": [
    "BODY_LIMIT_LARGE_JSON",
    "readTextBodyLimited(request, MAX_IMPORT_BODY_CHARS)",
    "readJsonBodyLimited(request, BODY_LIMIT_LARGE_JSON)",
  ],
  "src/app/api/extract/run/route.ts": [
    "BODY_LIMIT_LARGE_JSON",
    "readJsonBodyLimitedWithRaw(request, BODY_LIMIT_LARGE_JSON)",
  ],
  "src/app/api/stripe/webhook/route.ts": [
    "STRIPE_WEBHOOK_BODY_MAX",
    "readTextBodyLimited(request, STRIPE_WEBHOOK_BODY_MAX)",
  ],
  "src/app/api/tasks/from-slack/route.ts": [
    "SLACK_INBOUND_BODY_MAX",
    "readTextBodyLimited(request, SLACK_INBOUND_BODY_MAX)",
  ],
  "src/app/api/tasks/from-email/route.ts": [
    "EMAIL_INBOUND_SIGNED_BODY_MAX",
    "readTextBodyLimited(request, EMAIL_INBOUND_SIGNED_BODY_MAX)",
  ],
  "src/app/api/integrations/actions/callback/route.ts": [
    "BODY_LIMIT_STRICT_INBOUND",
    "readJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND)",
  ],
  "src/app/api/webhooks/dispatch/route.ts": [
    "BODY_LIMIT_STRICT_INBOUND",
    "readJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND)",
  ],
};
const REQUIRED_ROUTE_POLICIES = {
  "/api/programs": {
    methods: ["GET", "POST"],
    cachePolicy: "private_no_store",
    bodyPolicy: "bounded_or_form_body",
  },
  "/api/extract": {
    methods: ["POST"],
    cachePolicy: "private_no_store",
    bodyPolicy: "bounded_or_form_body",
  },
  "/api/integrations/oauth/start": {
    methods: ["POST"],
    cachePolicy: "private_no_store",
    bodyPolicy: "bounded_or_form_body",
  },
};
const RAW_REQUEST_BODY_RE = /\brequest\.(?:json|text)\s*\(/;

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function readJson(root, rel) {
  return JSON.parse(read(root, rel));
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function loadRouteUniverseRows(root, issues) {
  const rel = "artifacts/route-universe.json";
  if (!fileExists(root, rel)) {
    issues.push({ issue: "missing_required_file", rel });
    return [];
  }
  try {
    const payload = readJson(root, rel);
    const rows = payload?.routes ?? payload?.universe?.routes;
    if (!Array.isArray(rows)) {
      issues.push({ issue: "invalid_route_universe_shape", rel });
      return [];
    }
    return rows;
  } catch (error) {
    issues.push({ issue: "invalid_json", rel, message: error instanceof Error ? error.message : String(error) });
    return [];
  }
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

function findRawRequestBodyIssues(root) {
  const issues = [];
  const apiRoot = path.join(root, "src", "app", "api");
  for (const abs of walkRoutes(apiRoot).sort()) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const source = read(root, rel);
    if (RAW_REQUEST_BODY_RE.test(source)) {
      issues.push({ issue: "raw_request_body_read", rel });
    }
  }
  return issues;
}

export function analyzeCsrfSurfaceGuards(root = ROOT) {
  const issues = [];
  issues.push(...findRawRequestBodyIssues(root));

  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  const routeRows = loadRouteUniverseRows(root, issues);
  for (const [route, expected] of Object.entries(REQUIRED_ROUTE_POLICIES)) {
    const row = routeRows.find((candidate) => candidate.route === route);
    if (!row) {
      issues.push({ issue: "missing_route_universe_row", route });
      continue;
    }
    if (JSON.stringify(row.methods) !== JSON.stringify(expected.methods)) {
      issues.push({ issue: "unexpected_route_methods", route, expected: expected.methods, actual: row.methods });
    }
    if (row.cachePolicy !== expected.cachePolicy) {
      issues.push({ issue: "unexpected_route_cache_policy", route, expected: expected.cachePolicy, actual: row.cachePolicy });
    }
    if (row.bodyPolicy !== expected.bodyPolicy) {
      issues.push({ issue: "unexpected_route_body_policy", route, expected: expected.bodyPolicy, actual: row.bodyPolicy });
    }
  }

  return {
    checkId: "csrf-surface-guards",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeCsrfSurfaceGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
