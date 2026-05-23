#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:api-cors-policy"];
const REQUIRED_CI_COMMANDS = ["npm run check:api-cors-policy"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:api-cors-policy"'];
const REQUIRED_TEST_MARKERS = [
  "rejects wildcard CORS on API routes",
  "rejects wildcard CORS combined with credentials",
];

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function walkApiRoutes(root, rel = "src/app/api", out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = path.join(rel, ent.name).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      walkApiRoutes(root, childRel, out);
    } else if (ent.name === "route.ts" || ent.name === "route.tsx") {
      out.push(childRel);
    }
  }
  return out;
}

function hasWildcardCors(source) {
  return (
    /Access-Control-Allow-Origin["'`]?[\s\S]{0,160}["'`]\*["'`]/i.test(source) ||
    /["'`]access-control-allow-origin["'`][\s\S]{0,160}["'`]\*["'`]/i.test(source)
  );
}

function hasCredentialedCors(source) {
  return (
    /Access-Control-Allow-Credentials["'`]?[\s\S]{0,160}["'`]true["'`]/i.test(source) ||
    /["'`]access-control-allow-credentials["'`][\s\S]{0,160}["'`]true["'`]/i.test(source)
  );
}

export function analyzeApiCorsPolicy(root = ROOT) {
  const issues = [];

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = exists(root, ".github/workflows/ci.yml") ? read(root, ".github/workflows/ci.yml") : "";
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const pipelineRel = "scripts/pipelines/pipeline-security-comprehensive.mjs";
  const pipeline = exists(root, pipelineRel) ? read(root, pipelineRel) : "";
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!pipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  const testRel = "scripts/check-api-cors-policy.test.mjs";
  if (!exists(root, testRel)) {
    issues.push({ issue: "missing_test_file", rel: testRel });
  } else {
    const testSource = read(root, testRel);
    for (const marker of REQUIRED_TEST_MARKERS) {
      if (!testSource.includes(marker)) issues.push({ issue: "missing_test_marker", rel: testRel, marker });
    }
  }

  for (const rel of walkApiRoutes(root).sort()) {
    const source = read(root, rel);
    if (!hasWildcardCors(source)) continue;
    issues.push({
      issue: hasCredentialedCors(source) ? "credentialed_wildcard_cors" : "wildcard_cors",
      rel,
    });
  }

  return { checkId: "api-cors-policy", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeApiCorsPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
