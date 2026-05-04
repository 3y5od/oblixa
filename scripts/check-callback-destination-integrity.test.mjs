import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCallbackDestinationIntegrity } from "./check-callback-destination-integrity.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeCallbackDestinationIntegrity validates safe post-auth callback landing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-callback-destination-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:callback-destination-integrity": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:callback-destination-integrity\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:callback-destination-integrity"\n');
  write(root, "src/app/auth/callback/route.ts", 'const next = getSafeRedirectPath(searchParams.get("next"))\nconst destination = await resolvePostAuthRedirectPath(admin, orgIdForLanding, next)\nconst finalDestination = resolveDestinationWithBlockingCalibration(destination, calibrationPath)\nreturn NextResponse.redirect(`${origin}${finalDestination}`)\nreturn NextResponse.redirect(`${origin}/login?error=auth_callback_error`)\n');
  write(root, "src/lib/auth/post-auth-redirect.ts", 'const homePaths = new Set(["/dashboard", getSafeRedirectPath(null)])\nreturn getSafeRedirectPath(resolved)\n');
  write(root, "src/app/auth/refinement-auth-callback.test.ts", 'it("provisions an org for non-invite callbacks and redirects to the resolved destination", async () => {})\nexpect(res.headers.get("location")).toBe("http://localhost:3000/dashboard")\n');

  const report = analyzeCallbackDestinationIntegrity(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});