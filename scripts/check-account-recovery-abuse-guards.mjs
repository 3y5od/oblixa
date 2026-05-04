#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:account-recovery-abuse-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:account-recovery-abuse-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:account-recovery-abuse-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/actions/auth.ts": [
    "export async function forgotPassword(formData: FormData) {",
    'rateLimitCheck(`forgot:${ip}`, RATE_LIMITS.forgotPassword);',
    'return { error: "Too many reset requests. Try again later." };',
    'const { error } = await supabase.auth.resetPasswordForEmail(email, {',
    'redirectTo: `${appUrl}/reset-password`,',
    'return { success: "Check your email for a password reset link." };',
  ],
  "src/lib/rate-limit.ts": ['forgotPassword: { max: 8, windowMs: 60 * 60_000 },'],
  "src/actions/auth-actions.test.ts": [
    'it("forgotPassword returns error when rate limited"',
    'it("forgotPassword requests a reset link using the reset-password route"',
    'expect(authServerMocks.resetPasswordForEmail).toHaveBeenCalledWith("recover@example.com", {',
    'redirectTo: "http://localhost:3000/reset-password",',
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

export function analyzeAccountRecoveryAbuseGuards(root = ROOT) {
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

  return { checkId: "account-recovery-abuse-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAccountRecoveryAbuseGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
