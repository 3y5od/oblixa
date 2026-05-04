#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:oauth-state-integrity"];
const REQUIRED_CI_COMMANDS = ["npm run check:oauth-state-integrity"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:oauth-state-integrity"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/api/integrations/oauth/start/route.ts": [
    'const state = randomBytes(16).toString("hex")',
    '.from("integration_oauth_states").insert({',
    'expires_at: expiresAt',
    'requested_by: user.id',
    'redirect_uri: redirect.toString()',
  ],
  "src/app/api/integrations/oauth/callback/route.ts": [
    '.from("integration_oauth_states")',
    '.eq("state", state)',
    'if (!authState) return NextResponse.json({ error: "Invalid state" }, { status: 400 })',
    'if (authState.consumed_at)',
    'if (new Date(authState.expires_at).getTime() < Date.now())',
    '.update({ consumed_at: new Date().toISOString() })',
  ],
  "src/app/api/integrations/oauth/start/route.test.ts": [
    'it("returns 500 when oauth state insert fails"',
    'it("blocks duplicate replay of oauth start with x-idempotency-key"',
  ],
  "src/app/api/integrations/oauth/callback/route.test.ts": [
    'it("returns 400 when oauth state row is missing (invalid state)"',
    'expect(body).toEqual({ error: "Invalid state" })',
    'expect(body).toEqual({ error: "Failed to load oauth state" })',
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeOAuthStateIntegrity(root = ROOT) {
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

  return { checkId: "oauth-state-integrity", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOAuthStateIntegrity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
