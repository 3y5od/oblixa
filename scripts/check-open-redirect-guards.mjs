#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:open-redirect-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:open-redirect-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:open-redirect-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/redirect.ts": [
    "export function getSafeRedirectPath",
    'const fallback = "/dashboard"',
    'if (!s.startsWith("/") || s.startsWith("//") || s.includes("://"))',
    'if (/[\\x00-\\x1f\\x7f\\\\]/.test(s) || s.includes("@") || s.includes("<"))',
  ],
  "src/lib/security/redirect.test.ts": [
    "rejects protocol-relative paths (open redirect)",
    "rejects absolute URLs and encoded slashes",
    "rejects javascript: and CRLF injection attempts",
  ],
  "src/app/auth/callback/route.ts": [
    "const next = getSafeRedirectPath(searchParams.get(\"next\"))",
    'return NextResponse.redirect(`${origin}${finalDestination}`)',
  ],
  "src/app/api/reports/track/click/[token]/route.ts": [
    "function getSafeTarget(request: Request)",
    "if (targetRaw.startsWith(\"//\")) return safeFallback(request)",
    'if (!["http:", "https:"].includes(target.protocol))',
    'const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()',
    "if (target.origin !== allowedOrigin) return safeFallback(request)",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeOpenRedirectGuards(root = ROOT) {
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

  return { checkId: "open-redirect-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOpenRedirectGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
