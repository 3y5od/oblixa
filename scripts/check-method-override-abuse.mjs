#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:method-override-abuse"];
const REQUIRED_CI_COMMANDS = ["npm run check:method-override-abuse"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:method-override-abuse"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/sec-fetch-policy.ts": [
    "export const METHOD_OVERRIDE_HEADERS",
    '"x-http-method-override"',
    '"x-method-override"',
    '"x-http-method"',
    '"x-method"',
    "export const METHOD_OVERRIDE_QUERY_PARAMS",
    '"_method"',
    '"httpMethod"',
    "export function hasMethodOverrideAttempt(request: Request): boolean",
    "request.headers.has(header)",
    "url.searchParams.has(param)",
  ],
  "src/lib/security/sec-fetch-policy.test.ts": [
    'describe("hasMethodOverrideAttempt"',
    'it("rejects method override headers"',
    'it("rejects method override query parameters"',
    'it("allows normal API requests without override signals"',
  ],
  "src/proxy.ts": [
    "hasMethodOverrideAttempt(request)",
    'pathname.startsWith("/api/")',
    'code: "method_override_rejected"',
    'diagnostic_id: "proxy_method_override_rejected"',
  ],
  "src/proxy.invariants.test.ts": [
    "hasMethodOverrideAttempt(request)",
    'code: "method_override_rejected"',
  ],
};
const OVERRIDE_HEADER_RE = /headers\.get\(\s*["'`](?:x-http-method-override|x-method-override|x-http-method|x-method)["'`]\s*\)/i;
const OVERRIDE_QUERY_RE = /searchParams\.get\(\s*["'`](?:_method|method|httpMethod|x-http-method-override|x-method-override)["'`]\s*\)/;

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRoutes(abs, acc);
    else if (entry.name === "route.ts") acc.push(abs);
  }
  return acc;
}

function missingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeMethodOverrideAbuse(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) issues.push({ issue: "missing_required_file", rel });
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
    if (!exists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of missingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  for (const abs of walkRoutes(path.join(root, "src", "app", "api")).sort()) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    if (OVERRIDE_HEADER_RE.test(source) || OVERRIDE_QUERY_RE.test(source)) {
      issues.push({ issue: "route_reads_method_override_signal", rel });
    }
  }

  return {
    checkId: "method-override-abuse",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeMethodOverrideAbuse();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
