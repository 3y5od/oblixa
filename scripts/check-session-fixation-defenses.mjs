#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:session-fixation-defenses"];
const REQUIRED_CI_COMMANDS = ["npm run check:session-fixation-defenses"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:session-fixation-defenses"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/auth/callback/route.ts": [
    "exchangeCodeForSession(code)",
    "getSafeRedirectPath(searchParams.get(\"next\"))",
    "resolvePostAuthRedirectPath",
    "resolveDestinationWithBlockingCalibration",
  ],
  "src/lib/security/step-up-cookie.ts": [
    "randomBytes(16).toString(\"hex\")",
    "timingSafeEqual",
    "if (uid !== userId) return false",
    "Date.now() > exp",
    'createHmac("sha256"',
  ],
  "src/lib/security/step-up-cookie.test.ts": [
    "mints and validates a cookie for the same user",
    'expect(isStepUpCookieValidForUser(jar, "22222222-2222-2222-2222-222222222222")).toBe(false)',
  ],
  "src/app/api/settings/step-up/route.ts": [
    "const ok = res.ok",
    "const token = mintStepUpCookieValue(user.id)",
    "jar.set(STEP_UP_COOKIE_NAME, token, {",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeSessionFixationDefenses(root = ROOT) {
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

  return { checkId: "session-fixation-defenses", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSessionFixationDefenses();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
