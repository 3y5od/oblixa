#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:lockout-reset-safety"];
const REQUIRED_CI_COMMANDS = ["npm run check:lockout-reset-safety"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:lockout-reset-safety"'];
const REQUIRED_FILE_MARKERS = {
  "src/actions/auth.ts": [
    'const t0 = Date.now();',
    'await new Promise((r) => setTimeout(r, Math.max(0, 200 - elapsed)));',
    'return { error: mapAuthError(error.message) };',
    'export async function resetPassword(formData: FormData) {',
    "const password = readAuthPassword(formData, { requireMinimum: true });",
    "if (!password.ok) return { error: password.error };",
    "const { error } = await supabase.auth.updateUser({ password: password.value });",
  ],
  "src/lib/errors/user-facing.ts": [
    'if (lower.includes("invalid login credentials")) {',
    'return "Invalid email or password.";',
    'if (lower.includes("rate limit") || lower.includes("too many requests")) {',
    'return "Too many attempts. Wait a few minutes and try again.";',
  ],
  "src/actions/auth-actions.test.ts": [
    'it("resetPassword rejects too-short replacement passwords before calling updateUser"',
    'it("resetPassword rejects unsafe replacement passwords before calling updateUser"',
    'expect(authServerMocks.updateUser).not.toHaveBeenCalled()',
    'expect(authServerMocks.updateUser).toHaveBeenCalledWith({ password: "longpassword123" });',
    'describe("resetPassword redirect resolution"',
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

export function analyzeLockoutResetSafety(root = ROOT) {
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

  return { checkId: "lockout-reset-safety", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeLockoutResetSafety();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
