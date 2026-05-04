import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeEmailIdentitySpoofGuards } from "./check-email-identity-spoof-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeEmailIdentitySpoofGuards validates invite-email binding and mail-header hygiene", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-email-identity-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:email-identity-spoof-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:email-identity-spoof-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:email-identity-spoof-guards"\n');
  write(root, "src/app/auth/callback/route.ts", 'if (!emailLower || emailLower !== inv.email.toLowerCase()) {\nreturn NextResponse.redirect(`${origin}/login?error=invite_email_mismatch`);\n}\n');
  write(root, "src/app/(auth)/login/page.tsx", '} else if (q.error === "invite_email_mismatch") {\n"Sign in with the same email address the invitation was sent to."\n}\n');
  write(root, "src/actions/settings.ts", 'if (isKillInvites()) {\nreturn { error: "Invitations are temporarily disabled." };\n}\nconst redirectTo = `${appUrl}/auth/callback`;\ninviteUserByEmail(email, {\n  data: {\n    invite_id: inviteRow.id,\n  },\n});\nconst sent = await sendWorkspaceInviteLinkEmail({ to: email, actionUrl });\n');
  write(root, "src/lib/email.ts", 'function sanitizeSubject(s: string): string {\nreturn s.replace(/[\\r\\n]+/g, " ").trim();\n}\nfrom: process.env.EMAIL_FROM || "onboarding@resend.dev",\nsubject: sanitizeSubject("You\'re invited to an Oblixa workspace"),\n');
  write(root, "src/lib/email/list-unsubscribe-header.ts", 'export function assertNoCrlfInHeaderValue(value: string): void {\nthrow new Error("header_value_contains_crlf");\n}\nparams.set("List-Unsubscribe", "One-Click");\n');
  write(root, "src/lib/email/list-unsubscribe-header.test.ts", 'it("rejects CRLF injection in header values", () => {})\nexpect(() => assertNoCrlfInHeaderValue("bad\\r\\nBcc: attacker@x")).toThrow(/crlf/i);\n');
  write(root, "src/app/auth/refinement-auth-callback.test.ts", 'it("rejects invite callbacks when the signed-in email does not match the invite target", async () => {})\nexpect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invite_email_mismatch");\n');

  const report = analyzeEmailIdentitySpoofGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});