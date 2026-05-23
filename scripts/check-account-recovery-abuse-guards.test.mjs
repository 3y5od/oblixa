import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAccountRecoveryAbuseGuards } from "./check-account-recovery-abuse-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeAccountRecoveryAbuseGuards validates forgot-password throttling and reset-link handling", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-account-recovery-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:account-recovery-abuse-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:account-recovery-abuse-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:account-recovery-abuse-guards"\n');
  write(root, "src/actions/auth.ts", 'export async function forgotPassword(formData: FormData) {\nrateLimitCheck(`forgot:${ip}`, RATE_LIMITS.forgotPassword);\nreturn { error: "Too many reset requests. Try again later." };\nconst email = readAuthEmail(formData);\nif (!email.ok) return { error: email.error };\nconst { error } = await supabase.auth.resetPasswordForEmail(email.value, {\nredirectTo: `${appUrl}/reset-password`,\n});\nreturn { success: "Check your email for a password reset link." };\n}\n');
  write(root, "src/lib/rate-limit.ts", 'forgotPassword: { max: 8, windowMs: 60 * 60_000 },\n');
  write(root, "src/actions/auth-actions.test.ts", 'it("forgotPassword returns error when rate limited", async () => {})\nit("forgotPassword requests a reset link using the reset-password route", async () => {})\nexpect(authServerMocks.resetPasswordForEmail).toHaveBeenCalledWith("recover@example.com", {\nredirectTo: "http://localhost:3000/reset-password",\n});\n');

  const report = analyzeAccountRecoveryAbuseGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
