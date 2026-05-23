#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:callback-domain-strictness"];
const REQUIRED_CI_COMMANDS = ["npm run check:callback-domain-strictness"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:callback-domain-strictness"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/api/integrations/oauth/start/route.ts": [
    "const authorize = validateOutboundHttpUrl(providerConfig.authorizeUrl)",
    "const requestOrigin = getRequestOrigin(request)",
    '`${requestOrigin}/api/integrations/oauth/callback`',
    "if (redirect.origin !== requestOrigin)",
    'redirect.pathname === "/api/integrations/oauth/callback"',
    'redirectUri must match request origin',
  ],
  "src/app/api/integrations/oauth/callback/route.ts": [
    "const requestOrigin = getRequestOrigin(request)",
    'redirect.pathname === "/api/integrations/oauth/callback"',
    'diagnostic_id: "oauth_callback_redirect_uri_invalid"',
  ],
  "src/actions/settings.ts": [
    "const appUrl = await resolveAppBaseUrl()",
    'const redirectTo = `${appUrl}/auth/callback`',
    "inviteUserByEmail(email, {",
    "inviteUserByEmail(inv.email, {",
  ],
  "src/lib/app-url.ts": [
    "export function getRequestOrigin(request: Request)",
    "export async function resolveAppBaseUrl(): Promise<string>",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeCallbackDomainStrictness(root = ROOT) {
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

  return { checkId: "callback-domain-strictness", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeCallbackDomainStrictness();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
