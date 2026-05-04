import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSessionFixationDefenses } from "./check-session-fixation-defenses.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSessionFixationDefenses validates session rotation and signed step-up cookie signals", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-session-fixation-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:session-fixation-defenses": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:session-fixation-defenses\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:session-fixation-defenses"\n');
  write(root, "src/app/auth/callback/route.ts", 'exchangeCodeForSession(code)\ngetSafeRedirectPath(searchParams.get("next"))\nresolvePostAuthRedirectPath\nresolveDestinationWithBlockingCalibration\n');
  write(root, "src/lib/security/step-up-cookie.ts", 'import { createHmac, randomBytes, timingSafeEqual } from "crypto";\nconst nonce = randomBytes(16).toString("hex");\nif (uid !== userId) return false;\nif (Date.now() > exp) return false;\ncreateHmac("sha256", "x");\n');
  write(root, "src/lib/security/step-up-cookie.test.ts", 'mints and validates a cookie for the same user\nexpect(isStepUpCookieValidForUser(jar, "22222222-2222-2222-2222-222222222222")).toBe(false)\n');
  write(root, "src/app/api/settings/step-up/route.ts", 'const ok = res.ok;\nconst token = mintStepUpCookieValue(user.id);\njar.set(STEP_UP_COOKIE_NAME, token, {\n');

  const report = analyzeSessionFixationDefenses(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});