import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeLockoutResetSafety } from "./check-lockout-reset-safety.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeLockoutResetSafety validates generic auth-failure softening and reset password safety", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-lockout-reset-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:lockout-reset-safety": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:lockout-reset-safety\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:lockout-reset-safety"\n');
  write(root, "src/actions/auth.ts", 'const t0 = Date.now();\nawait new Promise((r) => setTimeout(r, Math.max(0, 200 - elapsed)));\nreturn { error: mapAuthError(error.message) };\nexport async function resetPassword(formData: FormData) {\nif (!password || password.length < 8 || password.length > 128) return { error: "Password must be between 8 and 128 characters." };\nconst { error } = await supabase.auth.updateUser({ password });\n}\n');
  write(root, "src/lib/errors/user-facing.ts", 'if (lower.includes("invalid login credentials")) {\nreturn "Invalid email or password.";\n}\nif (lower.includes("rate limit") || lower.includes("too many requests")) {\nreturn "Too many attempts. Wait a few minutes and try again.";\n}\n');
  write(root, "src/actions/auth-actions.test.ts", 'describe("resetPassword redirect resolution", () => {})\nit("resetPassword rejects too-short replacement passwords before calling updateUser", async () => {})\nexpect(authServerMocks.updateUser).not.toHaveBeenCalled()\nexpect(authServerMocks.updateUser).toHaveBeenCalledWith({ password: "longpassword123" });\n');

  const report = analyzeLockoutResetSafety(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});