#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:email-identity-spoof-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:email-identity-spoof-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:email-identity-spoof-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/auth/callback/route.ts": [
    'if (!emailLower || emailLower !== inv.email.toLowerCase()) {',
    'return NextResponse.redirect(`${origin}/login?error=invite_email_mismatch`);',
  ],
  "src/app/(auth)/login/page.tsx": [
    '} else if (q.error === "invite_email_mismatch") {',
    '"Sign in with the same email address the invitation was sent to."',
  ],
  "src/actions/settings.ts": [
    'if (isKillInvites()) {',
    'return { error: "Invitations are temporarily disabled." };',
    'const redirectTo = `${appUrl}/auth/callback`;',
    'inviteUserByEmail(email, {',
    'invite_id: inviteRow.id,',
    'const sent = await sendWorkspaceInviteLinkEmail({ to: email, actionUrl });',
  ],
  "src/lib/email.ts": [
    'function sanitizeSubject(s: string): string {',
    'return s.replace(/[\\r\\n]+/g, " ").trim();',
    'from: process.env.EMAIL_FROM || "onboarding@resend.dev",',
    'subject: sanitizeSubject("You\'re invited to an Oblixa workspace"),',
  ],
  "src/lib/email/list-unsubscribe-header.ts": [
    'export function assertNoCrlfInHeaderValue(value: string): void {',
    'throw new Error("header_value_contains_crlf");',
    'params.set("List-Unsubscribe", "One-Click");',
  ],
  "src/lib/email/list-unsubscribe-header.test.ts": [
    'it("rejects CRLF injection in header values"',
    'expect(() => assertNoCrlfInHeaderValue("bad\\r\\nBcc: attacker@x")).toThrow(/crlf/i);',
  ],
  "src/app/auth/refinement-auth-callback.test.ts": [
    'it("rejects invite callbacks when the signed-in email does not match the invite target"',
    'expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invite_email_mismatch");',
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

export function analyzeEmailIdentitySpoofGuards(root = ROOT) {
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

  return { checkId: "email-identity-spoof-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeEmailIdentitySpoofGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
