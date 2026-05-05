#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "EXTRACTION_WORKER_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  "STRIPE_WEBHOOK_SECRET",
  "EXTERNAL_ACTION_PASSCODE_PEPPER",
  "EXTERNAL_ACTION_SUBMIT_TICKET_SECRET",
  "OBLIXA_STRICT_ENV",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "HC_SLO_MONITOR_PING",
  "STAGING_BASE_URL",
  "SYNTHETIC_STRICT",
  "SLO_BUDGETS_STRICT",
];

const REQUIRED_PACKAGE_SCRIPTS = [
  "check:api-runtime-smoke-registry",
  "check:env-example-parity",
  "check:synthetic-slo-env",
  "check:config-drift",
  "check:security-env-contract",
];

const WORKFLOW_MARKERS = {
  ci: [
    "npm run check:api-runtime-smoke-registry",
    "npm run check:env-example-parity",
    "npm run check:synthetic-slo-env",
    "npm run check:config-drift",
    "npm run check:security-env-contract",
  ],
  qaCodeMaximal: ["synthetic_slo", "STAGING_BASE_URL", "SLO_BUDGETS_STRICT"],
  qaMaxNightly: ["API runtime smoke (Epic 3 nightly tier)", "API_RUNTIME_SMOKE_BASE_URL", "STAGING_BASE_URL"],
  sloMonitor: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "HC_SLO_MONITOR_PING",
    "REQUIRE_SLO_MONITOR",
    "scripts/github-actions/secret-gate.sh",
    "node scripts/slo-monitor.mjs",
  ],
};

export function parseEnvExampleKeys(text) {
  const keys = new Set();
  for (const match of text.matchAll(/^\s*#?\s*([A-Z0-9_]+)=/gm)) {
    keys.add(match[1]);
  }
  return keys;
}

function collectMissingMarkers(text, markers) {
  return markers.filter((marker) => !text.includes(marker));
}

export function analyzeSecurityEnvContract(root = process.cwd()) {
  const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  const qaCodeMaximal = fs.readFileSync(path.join(root, ".github", "workflows", "qa-code-maximal.yml"), "utf8");
  const qaMaxNightly = fs.readFileSync(path.join(root, ".github", "workflows", "qa-max-nightly.yml"), "utf8");
  const sloMonitor = fs.readFileSync(path.join(root, ".github", "workflows", "slo-monitor.yml"), "utf8");
  const envKeys = parseEnvExampleKeys(envExample);
  const issues = [];

  for (const key of REQUIRED_ENV_KEYS) {
    if (!envKeys.has(key)) {
      issues.push({ issue: "missing_env_example_key", key });
    }
  }

  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) {
      issues.push({ issue: "missing_package_script", script });
    }
  }

  for (const cmd of collectMissingMarkers(ci, WORKFLOW_MARKERS.ci)) {
    issues.push({ issue: "missing_ci_reference", cmd });
  }
  for (const marker of collectMissingMarkers(qaCodeMaximal, WORKFLOW_MARKERS.qaCodeMaximal)) {
    issues.push({ issue: "missing_qa_code_maximal_marker", marker });
  }
  for (const marker of collectMissingMarkers(qaMaxNightly, WORKFLOW_MARKERS.qaMaxNightly)) {
    issues.push({ issue: "missing_qa_max_nightly_marker", marker });
  }
  for (const marker of collectMissingMarkers(sloMonitor, WORKFLOW_MARKERS.sloMonitor)) {
    issues.push({ issue: "missing_slo_monitor_marker", marker });
  }

  return { issueCount: issues.length, issues };
}

const report = analyzeSecurityEnvContract();
console.log(JSON.stringify(report, null, 2));
if (report.issueCount > 0) process.exit(1);
