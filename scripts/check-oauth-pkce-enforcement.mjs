#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:oauth-pkce-enforcement"];
const REQUIRED_CI_COMMANDS = ["npm run check:oauth-pkce-enforcement"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:oauth-pkce-enforcement"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/api/integrations/oauth/start/route.ts": [
    'const verifier = randomBytes(32).toString("base64url")',
    'const challenge = createHash("sha256").update(verifier).digest("base64url")',
    'code_verifier: verifier',
    'code_challenge_method: "S256"',
    'url.searchParams.set("code_challenge", challenge)',
    'url.searchParams.set("code_challenge_method", "S256")',
  ],
  "src/app/api/integrations/oauth/callback/route.ts": [
    'if (!authState.redirect_uri || !authState.code_verifier)',
    'code_verifier: authState.code_verifier',
    'redirect_uri: authState.redirect_uri',
  ],
  "src/app/api/integrations/oauth/start/route.test.ts": [
    'expect(authorizeUrl.searchParams.get("code_challenge")).toBeTruthy()',
    'expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256")',
    'expect(row.code_challenge_method).toBe("S256")',
  ],
  "src/app/api/integrations/oauth/callback/route.test.ts": [
    'code_verifier: "verifier-123"',
    'redirect_uri: "http://localhost:3000/api/integrations/oauth/callback"',
    'code_verifier: "verifier-123",',
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeOAuthPkceEnforcement(root = ROOT) {
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

  return { checkId: "oauth-pkce-enforcement", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOAuthPkceEnforcement();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
