#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:http-method-policy"];
const REQUIRED_CI_COMMANDS = ["npm run check:http-method-policy"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:http-method-policy"'];
const ALLOWED_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const MUTATING_HTTP_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const SAFE_MUTATING_BODY_POLICIES = ["bounded_or_form_body", "no_body_rejected", "signature_bound_raw_body"];
const REQUIRED_FILE_MARKERS = {
  "scripts/lib/build-route-universe.mjs": [
    'export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];',
    "export function methodsFromSource(source) {",
    "const functionExport = new RegExp(",
    "const constExport = new RegExp(",
    "return functionExport.test(source) || constExport.test(source);",
    'if (/rejectUnexpectedBody/.test(source)) return "no_body_rejected";',
    'const methods = kind === "api_route" ? methodsFromSource(source) : ["GET"];',
  ],
  "src/app/api/programs/route.ts": [
    "export async function GET() {",
    "export async function POST(request: Request) {",
  ],
  "src/app/api/extract/route.ts": ['export async function POST(request: Request) {'],
  "src/app/auth/callback/route.ts": ['export async function GET(request: Request) {'],
};
const REQUIRED_ROUTE_METHODS = {
  "/api/programs": { methods: ["GET", "POST"], bodyPolicy: "bounded_or_form_body" },
  "/api/extract": { methods: ["POST"], bodyPolicy: "bounded_or_form_body" },
  "/auth/callback": { methods: ["GET"], bodyPolicy: "no_body_expected" },
};

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

export function analyzeHttpMethodPolicy(root = ROOT) {
  const issues = [];

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
  const apiRouteRows = routeRows.filter((row) => row.kind === "api_route");
  for (const row of apiRouteRows) {
    for (const method of Array.isArray(row.methods) ? row.methods : []) {
      if (!ALLOWED_HTTP_METHODS.includes(method)) {
        issues.push({ issue: "invalid_route_method", route: row.route, sourcePath: row.sourcePath, method });
      }
    }
    if (
      (Array.isArray(row.methods) ? row.methods : []).some((method) => MUTATING_HTTP_METHODS.includes(method)) &&
      !SAFE_MUTATING_BODY_POLICIES.includes(row.bodyPolicy)
    ) {
      issues.push({
        issue: "unsafe_mutating_route_body_policy",
        route: row.route,
        sourcePath: row.sourcePath,
        bodyPolicy: row.bodyPolicy,
      });
    }
  }

  for (const [route, expected] of Object.entries(REQUIRED_ROUTE_METHODS)) {
    const row = routeRows.find((candidate) => candidate.route === route);
    if (!row) {
      issues.push({ issue: "missing_route_universe_row", route });
      continue;
    }
    if (JSON.stringify(row.methods) !== JSON.stringify(expected.methods)) {
      issues.push({ issue: "unexpected_route_methods", route, expected: expected.methods, actual: row.methods });
    }
    if (row.bodyPolicy !== expected.bodyPolicy) {
      issues.push({ issue: "unexpected_route_body_policy", route, expected: expected.bodyPolicy, actual: row.bodyPolicy });
    }
  }

  return {
    checkId: "http-method-policy",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeHttpMethodPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
