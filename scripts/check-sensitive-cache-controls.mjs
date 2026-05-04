#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:sensitive-cache-controls"];
const REQUIRED_CI_COMMANDS = ["npm run check:sensitive-cache-controls"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:sensitive-cache-controls"'];
const REQUIRED_FILE_MARKERS = {
  "next.config.ts": [
    'source: "/api/:path*"',
    '{ key: "Cache-Control", value: "private, no-store" }',
    '{ key: "Pragma", value: "no-cache" }',
    '{ key: "Vary", value: "Cookie" }',
  ],
  "src/lib/security/api-guards.ts": [
    'export const API_PRIVATE_NO_STORE_HEADERS = {',
    '"Cache-Control": "private, no-store"',
    'Pragma: "no-cache"',
  ],
  "src/lib/security/cron-route-gate.ts": [
    'export const CRON_DENY_RESPONSE_HEADERS = {',
    '"Cache-Control": "private, no-store"',
    'Pragma: "no-cache"',
  ],
  "src/lib/http/problem.ts": [
    'export const PRIVATE_NO_STORE_HEADERS = {',
    '"Cache-Control": "private, no-store"',
    'Pragma: "no-cache"',
  ],
  "src/lib/security/api-guards.test.ts": ["API_PRIVATE_NO_STORE_HEADERS includes Cache-Control"],
  "src/lib/http/problem.test.ts": ["adds private no-store headers to problem responses"],
  "src/lib/assurance/next-config-api-headers.contract.test.ts": ["declares private no-store for /api/:path*"],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeSensitiveCacheControls(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fs.existsSync(path.join(root, rel))) issues.push({ issue: "missing_required_file", rel });
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
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "sensitive-cache-controls", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSensitiveCacheControls();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
