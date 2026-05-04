#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:trusted-host-handling"];
const REQUIRED_CI_COMMANDS = ["npm run check:trusted-host-handling"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:trusted-host-handling"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/trusted-forwarded.ts": [
    "export function getTrustedPublicOriginFromRequest(request: Request)",
    'request.headers.get("x-forwarded-proto")',
    'request.headers.get("x-forwarded-host")',
    'return `${proto}://${host}`',
  ],
  "src/lib/security/trusted-forwarded.test.ts": [
    "prefers x-forwarded-proto and x-forwarded-host when present",
    "falls back to request URL when forwards absent",
  ],
  "src/lib/app-url.ts": [
    'const host = h.get("x-forwarded-host") ?? h.get("host")',
    'h.get("x-forwarded-proto")',
    'return `${proto}://${host}`.replace(/\\/+$/, "")',
  ],
  "src/lib/app-url.test.ts": [
    "prefers x-forwarded-host and x-forwarded-proto when present",
    "builds an origin from forwarded headers as provided (edge must validate host trust)",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeTrustedHostHandling(root = ROOT) {
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
    if (!securityPipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "trusted-host-handling", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeTrustedHostHandling();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
