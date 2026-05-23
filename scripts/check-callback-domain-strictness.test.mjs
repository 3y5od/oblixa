import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCallbackDomainStrictness } from "./check-callback-domain-strictness.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeCallbackDomainStrictness validates same-origin callback construction", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-callback-domain-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:callback-domain-strictness": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:callback-domain-strictness\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:callback-domain-strictness"\n');
  write(root, "src/app/api/integrations/oauth/start/route.ts", 'const authorize = validateOutboundHttpUrl(providerConfig.authorizeUrl)\nconst requestOrigin = getRequestOrigin(request)\n`${requestOrigin}/api/integrations/oauth/callback`\nif (redirect.origin !== requestOrigin){}\nredirect.pathname === "/api/integrations/oauth/callback"\nreturn NextResponse.json({ error: "redirectUri must match request origin" }, { status: 400 })\n');
  write(root, "src/app/api/integrations/oauth/callback/route.ts", 'const requestOrigin = getRequestOrigin(request)\nredirect.pathname === "/api/integrations/oauth/callback"\ndiagnostic_id: "oauth_callback_redirect_uri_invalid"\n');
  write(root, "src/actions/settings.ts", 'const appUrl = await resolveAppBaseUrl()\nconst redirectTo = `${appUrl}/auth/callback`\ninviteUserByEmail(email, { redirectTo })\ninviteUserByEmail(inv.email, { redirectTo })\n');
  write(root, "src/lib/app-url.ts", 'export function getRequestOrigin(request: Request){}\nexport async function resolveAppBaseUrl(): Promise<string>{}\n');

  const report = analyzeCallbackDomainStrictness(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
