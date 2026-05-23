import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSessionLifecycleSecurity } from "./check-session-lifecycle-security.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSessionLifecycleSecurity validates sign-out and session revocation lifecycle", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-session-lifecycle-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:session-lifecycle-security": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:session-lifecycle-security\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:session-lifecycle-security"\n');
  write(root, "src/actions/auth.ts", 'action: "security.session_signed_out"\nawait supabase.auth.signOut()\nredirect("/api/auth/post-sign-out")\n');
  write(root, "src/actions/sessions.ts", 'hasSensitiveActionProof(supabase, user.id)\nbefore revoking other sessions\nneedStepUp: true as const\nawait supabase.auth.signOut({ scope: "others" })\naction: "security.sessions_revoke_others"\noutcome: "forbidden"\nreturn { success: true as const }\n');
  write(root, "src/actions/sessions.test.ts", 'revokeOtherSessions requires step-up or AAL2 before sign-out\nrevokeOtherSessions audits with organization_id when org present\nexpect(res).toEqual({ success: true })\n');
  write(root, "src/app/api/auth/post-sign-out/route.ts", `NextResponse.redirect(login)\nres.headers.set("Clear-Site-Data", '"cache", "cookies"')\n`);

  const report = analyzeSessionLifecycleSecurity(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
