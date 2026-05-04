#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:callback-destination-integrity"];
const REQUIRED_CI_COMMANDS = ["npm run check:callback-destination-integrity"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:callback-destination-integrity"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/auth/callback/route.ts": [
    'const next = getSafeRedirectPath(searchParams.get("next"))',
    'const destination = await resolvePostAuthRedirectPath(admin, orgIdForLanding, next)',
    'const finalDestination = resolveDestinationWithBlockingCalibration(destination, calibrationPath)',
    'return NextResponse.redirect(`${origin}${finalDestination}`)',
    'return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)',
  ],
  "src/lib/auth/post-auth-redirect.ts": [
    'const homePaths = new Set(["/dashboard", getSafeRedirectPath(null)])',
    'return getSafeRedirectPath(resolved)',
  ],
  "src/app/auth/refinement-auth-callback.test.ts": [
    'it("provisions an org for non-invite callbacks and redirects to the resolved destination"',
    'expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard")',
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeCallbackDestinationIntegrity(root = ROOT) {
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

  return { checkId: "callback-destination-integrity", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeCallbackDestinationIntegrity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
