#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CI_PATH = path.join(".github", "workflows", "ci.yml");
const RELEASE_PIPELINE_PATH = path.join("scripts", "pipelines", "pipeline-release-checklist.mjs");
const SECURITY_PIPELINE_PATH = path.join("scripts", "pipelines", "pipeline-security-comprehensive.mjs");

const REQUIRED_PACKAGE_SCRIPTS = [
  "check:release-artifact-provenance",
  "preflight:release",
  "verify",
  "check:comprehensive-pass",
  "test:e2e:current-product",
  "test:e2e:current-product",
  "test:e2e",
  "release:checklist",
];
const REQUIRED_CI_SIGNALS = [
  "actions/checkout@",
  "actions/setup-node@",
  "osv-scanner-action",
  "gitleaks-action@",
  "npm run check:release-artifact-provenance",
  "npm run sbom",
  "npm run check:lockfile-integrity-drift",
  "npm run check:sbom-integrity",
];
const REQUIRED_RELEASE_STEPS = [
  "preflight:release",
  "check:release-evidence",
  "check:release-suite-current",
  "verify",
  "check:comprehensive-pass",
  "test:e2e:current-product",
  "test:e2e",
];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:release-artifact-provenance"'];

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function hasFile(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function addMissingSnippets(issues, text, snippets, issueName, keyName) {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) issues.push({ issue: issueName, [keyName]: snippet });
  }
}

export function analyzeReleaseArtifactProvenance(root = process.cwd()) {
  const issues = [];
  for (const rel of ["package.json", CI_PATH, RELEASE_PIPELINE_PATH, SECURITY_PIPELINE_PATH]) {
    if (!hasFile(root, rel)) issues.push({ issue: "missing_release_provenance_file", path: rel });
  }
  if (issues.length > 0) {
    return { checkId: "release-artifact-provenance", ok: false, issueCount: issues.length, issues };
  }

  const pkg = readJson(root, "package.json");
  const ci = readText(root, CI_PATH);
  const releasePipeline = readText(root, RELEASE_PIPELINE_PATH);
  const securityPipeline = readText(root, SECURITY_PIPELINE_PATH);

  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }
  addMissingSnippets(issues, ci, REQUIRED_CI_SIGNALS, "missing_ci_provenance_signal", "signal");
  addMissingSnippets(issues, releasePipeline, REQUIRED_RELEASE_STEPS, "missing_release_checklist_step", "script");
  addMissingSnippets(
    issues,
    securityPipeline,
    REQUIRED_SECURITY_PIPELINE_STEPS,
    "missing_security_pipeline_provenance_step",
    "script"
  );

  return {
    checkId: "release-artifact-provenance",
    ok: issues.length === 0,
    packageScriptCount: REQUIRED_PACKAGE_SCRIPTS.length,
    ciSignalCount: REQUIRED_CI_SIGNALS.length,
    releaseStepCount: REQUIRED_RELEASE_STEPS.length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeReleaseArtifactProvenance();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
