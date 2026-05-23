#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:signed-request-freshness"];
const REQUIRED_CI_COMMANDS = ["npm run check:signed-request-freshness"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:signed-request-freshness"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/auth/callback/route.ts": [
    '.select("id, organization_id, email, role, expires_at, consumed_at, revoked_at")',
    'inv.consumed_at ||',
    'inv.revoked_at ||',
    'new Date(inv.expires_at).getTime() < Date.now()',
    '.update({ consumed_at: new Date().toISOString() })',
  ],
  "src/app/auth/refinement-auth-callback.test.ts": [
    'it("rejects invite callbacks when the signed-in email does not match the invite target", async () => {',
    'it("rejects invite callbacks when the invite is expired", async () => {',
  ],
  "src/app/api/integrations/oauth/callback/route.ts": [
    '.select(',
    '"id, organization_id, provider, requested_by, consumed_at, expires_at, redirect_uri, code_verifier, code_challenge_method"',
    'if (authState.consumed_at) {',
    'code: "state_already_used"',
    'if (new Date(authState.expires_at).getTime() < Date.now()) {',
    'code: "state_expired"',
    '.update({ consumed_at: new Date().toISOString() })',
  ],
  "src/app/api/integrations/oauth/callback/route.test.ts": [
    'it("returns 400 when oauth state already used", async () => {',
    'it("returns 400 when oauth state is expired", async () => {',
  ],
  "src/app/api/export/calendar/feed/[token]/route.ts": [
    '.select("id, organization_id, active, token_hash, expires_at, revoked_at")',
    'const feedCandidate = (feedRows ?? []).find((row) => !!row.token_hash && secureCompareUtf8(row.token_hash, tokenHash));',
    'const expired = !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();',
    'if (!row.active || row.revoked_at) {',
    'recordPublicTokenMiss({ surface: "calendar_feed"',
  ],
  "src/app/api/export/calendar/feed/[token]/route.test.ts": [
    'it("returns 404 when token is not found", async () => {',
    'it("returns 404 when feed is expired or revoked", async () => {',
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    'if (link.expires_at < nowIso()) {',
    '.update({ status: "expired" })',
    'code: "external_action_expired",',
    'if (link.status === "submitted") {',
  ],
  "src/app/api/external-actions/[token]/submit/route.test.ts": [
    'it("returns 409 when one-time link already submitted", async () => {',
    'it("returns 410 when external action link is expired", async () => {',
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

export function analyzeSignedRequestFreshness(root = ROOT) {
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

  return { checkId: "signed-request-freshness", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSignedRequestFreshness();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
