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
    'const len = request.headers.get("content-length");',
    '{ error: "Payload too large" },',
    'return { ok: true, body: text ? JSON.parse(text) : null };',
    "export async function parseJsonBodyWithLimit<T>(",
  ],
  "src/lib/security/read-json-body-limited.test.ts": [
    'it("rejects oversized body by Content-Length"',
    'it("parses small JSON"',
    'it("maps body through parse"',
  ],
  "scripts/lib/build-route-universe.mjs": [
    "function bodyPolicy(methods, source, cls) {",
    'const mutating = methods.some((method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method));',
    'if (/readJsonBodyLimited|parseJsonBodyWithLimit|readRequestBodyLimited|formData\\(/.test(source)) return "bounded_or_form_body";',
    'return "body_limit_required";',
  ],
  "src/app/api/programs/route.ts": [
    'const parsed = await readJsonBodyLimited(request);',
    'if (!parsed.ok) return parsed.response;',
  ],
  "src/app/api/extract/route.ts": [
    'const ctReject = jsonContentTypeRejection(request);',
    'const _limBody = await readJsonBodyLimited(request);',
    'if (!_limBody.ok) return _limBody.response;',
  ],
  "src/app/api/integrations/oauth/start/route.ts": [
    'const _lb_body = await readJsonBodyLimited(request);',
    'if (!_lb_body.ok) return _lb_body.response;',
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

export function analyzeCsrfSurfaceGuards(root = ROOT) {
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
