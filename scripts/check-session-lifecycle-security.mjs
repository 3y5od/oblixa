#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:session-lifecycle-security"];
const REQUIRED_CI_COMMANDS = ["npm run check:session-lifecycle-security"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:session-lifecycle-security"'];
const REQUIRED_FILE_MARKERS = {
  "src/actions/auth.ts": [
    'action: "security.session_signed_out"',
    "await supabase.auth.signOut()",
    'redirect("/api/auth/post-sign-out")',
  ],
  "src/actions/sessions.ts": [
    'await supabase.auth.signOut({ scope: "others" })',
    'action: "security.sessions_revoke_others"',
    'return { success: true as const }',
  ],
  "src/actions/sessions.test.ts": [
    "revokeOtherSessions audits with organization_id when org present",
    "expect(res).toEqual({ success: true })",
  ],
  "src/app/api/auth/post-sign-out/route.ts": [
    'NextResponse.redirect(login)',
    `res.headers.set("Clear-Site-Data", '"cache", "cookies"')`,
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeSessionLifecycleSecurity(root = ROOT) {
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

  return { checkId: "session-lifecycle-security", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSessionLifecycleSecurity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
