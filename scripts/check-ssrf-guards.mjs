#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_FILES = [
  "src/lib/security/safe-fetch.ts",
  "src/lib/security/safe-fetch.test.ts",
  "src/lib/security/url-policy.ts",
  "src/lib/security/url-policy.test.ts",
  "scripts/check-outbound-fetch.mjs",
  "scripts/check-outbound-domain-allowlist.mjs",
  "scripts/pipelines/pipeline-security-comprehensive.mjs",
  ".github/workflows/ci.yml",
];
const REQUIRED_PACKAGE_SCRIPTS = [
  "check:outbound-fetch",
  "check:outbound-domain-allowlist",
  "check:ssrf-guards",
];
const REQUIRED_CI_COMMANDS = [
  "npm run check:outbound-fetch",
  "npm run check:outbound-domain-allowlist",
  "npm run check:ssrf-guards",
];
const REQUIRED_SECURITY_PIPELINE_STEPS = [
  '"check:outbound-fetch"',
  '"check:outbound-domain-allowlist"',
  '"check:ssrf-guards"',
];
const SAFE_FETCH_MARKERS = [
  "export async function safeFetch",
  "export function isBlockedOutboundIpv4",
  "export function isBlockedOutboundIp",
  "dns.lookup(url.hostname",
  "allowLocalhostInDev",
];
const SAFE_FETCH_TEST_MARKERS = [
  "blocks loopback and private IPv4",
  "allows localhost only in non-production dev when explicitly requested",
];
const URL_POLICY_MARKERS = [
  "export function validateOutboundHttpUrl",
  'host === "localhost"',
  "isPrivateIpLiteral",
];
const URL_POLICY_TEST_MARKERS = [
  "rejects localhost and private IPv4 literals",
  "rejects non-http(s) schemes and malformed input",
];

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeSsrfGuards(root = ROOT) {
  const issues = [];
  for (const rel of REQUIRED_FILES) {
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

  const safeFetch = read(root, "src/lib/security/safe-fetch.ts");
  for (const marker of collectMissingMarkers(safeFetch, SAFE_FETCH_MARKERS)) {
    issues.push({ issue: "missing_safe_fetch_marker", marker });
  }

  const safeFetchTest = read(root, "src/lib/security/safe-fetch.test.ts");
  for (const marker of collectMissingMarkers(safeFetchTest, SAFE_FETCH_TEST_MARKERS)) {
    issues.push({ issue: "missing_safe_fetch_test_marker", marker });
  }

  const urlPolicy = read(root, "src/lib/security/url-policy.ts");
  for (const marker of collectMissingMarkers(urlPolicy, URL_POLICY_MARKERS)) {
    issues.push({ issue: "missing_url_policy_marker", marker });
  }

  const urlPolicyTest = read(root, "src/lib/security/url-policy.test.ts");
  for (const marker of collectMissingMarkers(urlPolicyTest, URL_POLICY_TEST_MARKERS)) {
    issues.push({ issue: "missing_url_policy_test_marker", marker });
  }

  return { checkId: "ssrf-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSsrfGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
