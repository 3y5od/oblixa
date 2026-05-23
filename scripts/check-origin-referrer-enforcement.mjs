#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:origin-referrer-enforcement"];
const REQUIRED_CI_COMMANDS = ["npm run check:origin-referrer-enforcement"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:origin-referrer-enforcement"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/sec-fetch-policy.ts": [
    "export function secFetchSiteAllowsSensitiveMutation(request: Request): boolean {",
    'if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;',
    "const requestOrigin = new URL(request.url).origin;",
    'const origin = request.headers.get("origin")?.trim();',
    'if (new URL(origin).origin !== requestOrigin) return false;',
    'const referer = request.headers.get("referer")?.trim();',
    'if (new URL(referer).origin !== requestOrigin) return false;',
    'const site = request.headers.get("sec-fetch-site")?.toLowerCase().trim();',
    "if (!origin && !referer && !site) return false;",
    'if (site === "same-origin" || site === "same-site") return true;',
    'if (site === "none") return true;',
    "if (site) return false;",
  ],
  "src/lib/security/sec-fetch-policy.test.ts": [
    'it("allows GET regardless of Sec-Fetch-Site"',
    'it("blocks cross-site POST"',
    'it("blocks POST when browser-origin metadata is absent"',
    'it("blocks cross-site Origin values"',
    'it("blocks hostile Referer when Origin is absent"',
    'it("allows explicit browser user activation requests"',
    'it("blocks cross-site form-style submissions"',
  ],
  "src/app/api/programs/route.ts": [
    'import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";',
    'if (!secFetchSiteAllowsSensitiveMutation(request)) {',
    'code: "cross_site_request_rejected"',
  ],
  "src/app/api/extract/route.ts": [
    'import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";',
    'if (!secFetchSiteAllowsSensitiveMutation(request)) {',
    'code: "cross_site_request_rejected"',
  ],
  "src/proxy.ts": [
    "secFetchSiteAllowsSensitiveMutation",
    'const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);',
    "function isBrowserOriginPolicyExemptApiPath(pathname: string): boolean {",
    'pathname.startsWith("/api/cron/")',
    'pathname.startsWith("/api/webhooks/")',
    'pathname.startsWith("/api/external-actions/")',
    'pathname === "/api/stripe/webhook"',
    'pathname === "/api/integrations/actions/callback"',
    "requiresBrowserOriginPolicy(request, pathname)",
    "secFetchSiteAllowsSensitiveMutation(request)",
    'code: "cross_site_request_rejected"',
  ],
};

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeOriginReferrerEnforcement(root = ROOT) {
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

  return {
    checkId: "origin-referrer-enforcement",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOriginReferrerEnforcement();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
