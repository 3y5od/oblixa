import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeInboundIdentityBoundaries } from "./check-inbound-identity-boundaries.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeInboundIdentityBoundaries validates inbound caller auth, signatures, and org allowlists", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-inbound-identity-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:inbound-identity-boundaries": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:inbound-identity-boundaries\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:inbound-identity-boundaries"\n');
  write(root, "src/lib/security/inbound-automation-token.ts", 'export function isInboundAutomationAuthorized(\nrequest: Request,\nroute: InboundAutomationRoute\n): boolean {\nconst expected = getInboundAutomationSecret(route);\nconst auth = parseBearerToken(request.headers.get("authorization"));\nreturn !!auth && secureCompareUtf8(auth, expected);\n}\n');
  write(root, "src/lib/security/inbound-automation-token.test.ts", 'it("uses route-specific secret when set", () => {})\nit("isInboundAutomationAuthorized returns true for matching bearer", () => {})\nit("isInboundAutomationAuthorized returns false for wrong token", () => {})\n');
  write(root, "src/lib/security/inbound-org-allowlist.ts", 'export function inboundOrgNotAllowedResponse(organizationId: string): NextResponse | null {\nreturn NextResponse.json({ error: "organizationId is required" }, { status: 400 });\nreturn NextResponse.json(\n{ error: "Organization not permitted for inbound automation" },\n{ status: 403 }\n);\n}\n');
  write(root, "src/lib/security/inbound-org-allowlist.test.ts", 'it("returns 403 when org is not in allowlist", async () => {})\nit("matches UUID case-insensitively", () => {})\n');
  write(root, "src/lib/security/inbound-email-signing.ts", 'export function verifyInboundEmailHmac(params: {\nsecret: string;\nrawBody: string;\nsignatureHeader: string | null;\n}) {\nif (!m) return { ok: false, reason: "missing_or_invalid_signature_format" };\nreturn { ok: false, reason: "signature_mismatch" };\nreturn { ok: true };\n}\n');
  write(root, "src/lib/security/inbound-email-signing.test.ts", 'it("accepts sha256 hex over raw body", () => {})\nit("rejects bad format", () => {})\n');
  write(root, "src/app/api/tasks/from-email/route.ts", 'return isInboundAutomationAuthorized(request, "email");\nconst mac = verifyInboundEmailHmac({\n});\nreturn NextResponse.json({ error: "Invalid email inbound signature" }, { status: 401 });\nconst orgBlocked = inboundOrgNotAllowedResponse(payload.organizationId);\n');
  write(root, "src/app/api/tasks/from-email/route.test.ts", 'it("returns 401 when inbound token is not configured", async () => {})\nit("returns 400 for invalid body when authorized", async () => {})\n');
  write(root, "src/app/api/tasks/from-slack/route.ts", 'return isInboundAutomationAuthorized(request, "slack");\nconst sig = verifySlackSigningSecret({\n});\nreturn NextResponse.json({ error: "Invalid Slack signature" }, { status: 401 });\nconst orgBlocked = inboundOrgNotAllowedResponse(body.organizationId);\n');
  write(root, "src/app/api/tasks/from-slack/route.test.ts", 'it("returns 401 when inbound token is not configured", async () => {})\nit("returns 400 for invalid body when authorized", async () => {})\n');
  write(root, "src/app/api/integrations/actions/callback/route.ts", 'if (!isInboundAutomationAuthorized(request, "integrations_callback")) {\nreturn NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n}\nconst blocked = inboundOrgNotAllowedResponse(organizationId);\n');
  write(root, "src/app/api/integrations/actions/callback/route.test.ts", 'it("returns 401 when no inbound secret is configured", async () => {})\nit("accepts INBOUND_INTEGRATIONS_CALLBACK_TOKEN instead of shared token", async () => {})\nit("returns 401 when bearer token does not match", async () => {})\n');

  const report = analyzeInboundIdentityBoundaries(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});