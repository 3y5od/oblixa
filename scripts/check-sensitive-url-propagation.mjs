#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:sensitive-url-propagation"];
const REQUIRED_CI_COMMANDS = ["npm run check:sensitive-url-propagation"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:sensitive-url-propagation"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/sensitive-url.ts": [
    "SENSITIVE_URL_PARAM_NAMES",
    "isSensitiveUrlParamName",
    "stripSensitiveUrlParams",
    "urlContainsSensitiveParams",
    "access_token",
    "signed_url",
    "private_url",
  ],
  "src/lib/security/sensitive-url.test.ts": [
    "strips sensitive query params while preserving safe params and hashes",
    "reports URLs that contain sensitive query params",
  ],
  "src/lib/security/redirect.ts": ["stripSensitiveUrlParams(s)", "return fallback"],
  "src/lib/security/redirect.test.ts": ["strips sensitive query parameters from browser-visible redirects"],
  "src/app/api/reports/track/click/[token]/route.ts": [
    "getSafeTarget(request)",
    "normalizeClickedTargetForStorage(target)",
    "redacted_query_keys",
  ],
  "src/app/auth/callback/route.ts": ['getSafeRedirectPath(searchParams.get("next"))'],
  "src/app/api/integrations/oauth/start/route.ts": ["redirect.search === \"\"", "redirect.hash === \"\""],
  "src/app/api/integrations/oauth/callback/route.ts": ["redirect.search === \"\"", "redirect.hash === \"\""],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzeSensitiveUrlPropagation(root = ROOT) {
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
    checkId: "sensitive-url-propagation",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSensitiveUrlPropagation();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
