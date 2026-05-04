#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:auth-cookie-attributes"];
const REQUIRED_CI_COMMANDS = ["npm run check:auth-cookie-attributes"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:auth-cookie-attributes"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/api/settings/step-up/route.ts": [
    "jar.set(STEP_UP_COOKIE_NAME, token, {",
    "httpOnly: true",
    'sameSite: "lax"',
    'secure: process.env.NODE_ENV === "production"',
    'path: "/"',
    "maxAge: 600",
  ],
  "src/actions/workflow-config.ts": [
    'cookieStore.set("oblixa_new_api_key_token", res.token, {',
    "httpOnly: true",
    'secure: process.env.NODE_ENV === "production"',
    'sameSite: "lax"',
    "maxAge: 300",
    'path: "/settings/operations"',
  ],
  "src/lib/supabase/server.ts": [
    "cookiesToSet.forEach(({ name, value, options }) =>",
    "cookieStore.set(name, value, options)",
  ],
  "src/proxy.ts": [
    "request.cookies.set(name, value)",
    "supabaseResponse.cookies.set(name, value, options)",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeAuthCookieAttributes(root = ROOT) {
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

  return { checkId: "auth-cookie-attributes", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAuthCookieAttributes();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
