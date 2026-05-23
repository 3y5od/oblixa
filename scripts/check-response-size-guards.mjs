#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:response-size-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:response-size-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:response-size-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/response-size.ts": [
    "API_RESPONSE_LIMIT_SMALL_JSON",
    "jsonResponseWithSizeLimit",
    "encodedJsonSizeBytes",
    "response_too_large",
    "api_response_size_limit_exceeded",
  ],
  "src/lib/security/response-size.test.ts": [
    "returns a safe problem response when the payload exceeds the limit",
    "response_too_large",
  ],
  "src/app/api/capacity/forecast/route.ts": [
    "jsonResponseWithSizeLimit",
    "API_RESPONSE_LIMIT_SMALL_JSON",
    "Cache-Control",
  ],
  "src/app/api/capacity/forecast/route.test.ts": [
    "rejects oversized forecast responses with a safe problem response",
    "response_too_large",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzeResponseSizeGuards(root = ROOT) {
  const issues = [];
  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }
  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }
  const pipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!pipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }
  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const text = read(root, rel);
    for (const marker of markers) {
      if (!text.includes(marker)) issues.push({ issue: "missing_marker", rel, marker });
    }
  }
  return {
    checkId: "response-size-guards",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeResponseSizeGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
