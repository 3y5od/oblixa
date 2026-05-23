#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const AUTH_STATUS_RE = /\bjsonProblem\s*\(\s*(401|403)\s*,\s*\{([\s\S]*?)(?:\n\s*\}\s*(?:,|\))|\}\s*\))/g;
const RAW_AUTH_RESPONSE_RE = /\b(?:NextResponse|Response)\.json\s*\([\s\S]{0,260}?\{\s*status\s*:\s*(401|403)\b/g;
const INTERNAL_DIAGNOSTIC_ROUTE_RE = /^src\/app\/api\/internal\//;

const REQUIRED_MARKERS = [
  {
    rel: "src/lib/http/problem.ts",
    markers: [
      "export function jsonUnauthorized(",
      'error: "Unauthorized"',
      'code: "unauthorized"',
      'diagnostic_id: "route_unauthorized"',
      "export function jsonForbidden(",
      'error: "Forbidden"',
      'code: "forbidden"',
      'diagnostic_id: "route_forbidden"',
    ],
  },
  {
    rel: "src/lib/security/api-guards.ts",
    markers: ["return jsonUnauthorized();", "return jsonForbidden();"],
  },
  {
    rel: "src/lib/v6/api-auth.ts",
    markers: ["jsonUnauthorized()", "jsonForbidden()"],
  },
  {
    rel: "src/lib/v6/feature-guards.ts",
    markers: ['code: "feature_disabled"', 'diagnostic_id: "v6_feature_disabled"', "jsonProblem(403"],
  },
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "route.ts") acc.push(p);
  }
  return acc;
}

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function hasField(block, fieldName) {
  return new RegExp(`\\b${fieldName}\\s*:`).test(block);
}

function literalField(block, fieldName) {
  const match = new RegExp(`\\b${fieldName}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`).exec(block);
  return match?.[1] ?? null;
}

export function analyzeAuthErrorConsistency(root = process.cwd()) {
  const routeRoot = path.join(root, "src", "app", "api");
  const routeFiles = walk(routeRoot).sort((a, b) => a.localeCompare(b));
  const issues = [];
  const routeStats = {
    routeFiles: routeFiles.length,
    helperUnauthorizedUses: 0,
    helperForbiddenUses: 0,
    directCustomAuthProblems: 0,
    internalDiagnosticAuthResponses: 0,
  };

  for (const required of REQUIRED_MARKERS) {
    const abs = path.join(root, required.rel);
    if (!fs.existsSync(abs)) {
      issues.push({ issue: "missing_required_auth_error_file", path: required.rel });
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    for (const marker of required.markers) {
      if (!text.includes(marker)) {
        issues.push({ issue: "missing_auth_error_marker", path: required.rel, marker });
      }
    }
  }

  for (const file of routeFiles) {
    const routeRel = rel(root, file);
    const text = fs.readFileSync(file, "utf8");
    routeStats.helperUnauthorizedUses += (text.match(/\bjsonUnauthorized\s*\(/g) ?? []).length;
    routeStats.helperForbiddenUses += (text.match(/\bjsonForbidden\s*\(/g) ?? []).length;

    RAW_AUTH_RESPONSE_RE.lastIndex = 0;
    for (const match of text.matchAll(RAW_AUTH_RESPONSE_RE)) {
      const status = Number(match[1]);
      if (INTERNAL_DIAGNOSTIC_ROUTE_RE.test(routeRel)) {
        routeStats.internalDiagnosticAuthResponses += 1;
        continue;
      }
      issues.push({ issue: "raw_auth_error_response", path: routeRel, status });
    }

    AUTH_STATUS_RE.lastIndex = 0;
    for (const match of text.matchAll(AUTH_STATUS_RE)) {
      const status = Number(match[1]);
      const block = match[2] ?? "";
      routeStats.directCustomAuthProblems += 1;

      if (!hasField(block, "code") || !hasField(block, "diagnostic_id")) {
        issues.push({ issue: "auth_problem_missing_code_or_diagnostic", path: routeRel, status });
      }

      const code = literalField(block, "code");
      const diagnosticId = literalField(block, "diagnostic_id");
      const error = literalField(block, "error");
      if (status === 401 && error === "Forbidden") {
        issues.push({ issue: "auth_problem_wrong_error_copy", path: routeRel, status, error });
      }
      if (status === 403 && error === "Unauthorized") {
        issues.push({ issue: "auth_problem_wrong_error_copy", path: routeRel, status, error });
      }
      if (
        (status === 401 && code === "unauthorized" && diagnosticId === "route_unauthorized") ||
        (status === 403 && code === "forbidden" && diagnosticId === "route_forbidden")
      ) {
        issues.push({ issue: "default_auth_problem_should_use_helper", path: routeRel, status });
      }
    }
  }

  if (routeStats.helperUnauthorizedUses === 0) {
    issues.push({ issue: "no_json_unauthorized_route_usage" });
  }
  if (routeStats.helperForbiddenUses === 0) {
    issues.push({ issue: "no_json_forbidden_route_usage" });
  }

  return {
    ok: issues.length === 0,
    ...routeStats,
    issueCount: issues.length,
    issues: issues.slice(0, 80),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAuthErrorConsistency();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
