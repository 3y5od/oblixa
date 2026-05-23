import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeOAuthPkceEnforcement } from "./check-oauth-pkce-enforcement.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeOAuthPkceEnforcement validates verifier/challenge persistence and callback use", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-oauth-pkce-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:oauth-pkce-enforcement": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:oauth-pkce-enforcement\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:oauth-pkce-enforcement"\n');
  write(root, "src/app/api/integrations/oauth/start/route.ts", 'const verifier = randomBytes(32).toString("base64url")\nconst challenge = createHash("sha256").update(verifier).digest("base64url")\ncode_verifier: verifier,\ncode_challenge_method: "S256",\nurl.searchParams.set("code_challenge", challenge)\nurl.searchParams.set("code_challenge_method", "S256")\n');
  write(root, "src/app/api/integrations/oauth/callback/route.ts", 'if (!authState.redirect_uri || !authState.code_verifier){}\nif (authState.code_challenge_method !== "S256"){}\ndiagnostic_id: "oauth_callback_pkce_method_invalid"\nredirect_uri: authState.redirect_uri,\ncode_verifier: authState.code_verifier,\n');
  write(root, "src/app/api/integrations/oauth/start/route.test.ts", 'expect(authorizeUrl.searchParams.get("code_challenge")).toBeTruthy()\nexpect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256")\nexpect(row.code_challenge_method).toBe("S256")\n');
  write(root, "src/app/api/integrations/oauth/callback/route.test.ts", 'redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",\ncode_verifier: "verifier-123",\nit("returns 400 when oauth state does not require S256 PKCE", () => {})\n');

  const report = analyzeOAuthPkceEnforcement(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
