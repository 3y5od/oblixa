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
  write(root, "src/lib/security/inbound-automation-token.ts", 'export function getInboundAutomationSecrets(\nINBOUND_AUTOMATION_TOKEN_PREVIOUS\nINBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS\nINBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS\nINBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS\nexport function isInboundAutomationAuthorized(\nrequest: Request,\nroute: InboundAutomationRoute\n): boolean {\nconst expectedSecrets = getInboundAutomationSecrets(route);\nconst auth = parseBearerToken(request.headers.get("authorization"));\nreturn !!auth && expectedSecrets.some((expected) => secureCompareUtf8(auth, expected));\n}\n');
  write(root, "src/lib/security/inbound-automation-token.test.ts", 'it("uses route-specific secret when set", () => {})\nit("isInboundAutomationAuthorized returns true for matching bearer", () => {})\nit("isInboundAutomationAuthorized returns false for wrong token", () => {})\nit("rejects shared token when a route-specific secret is configured", () => {})\nit("accepts previous route-specific and shared tokens during rotation", () => {})\n');
  write(root, "src/lib/security/inbound-org-allowlist.ts", 'export function inboundOrgNotAllowedResponse(organizationId: string): NextResponse | null {\nreturn NextResponse.json({ error: "organizationId is required" }, { status: 400 });\nreturn NextResponse.json(\n{ error: "Organization not permitted for inbound automation" },\n{ status: 403 }\n);\n}\n');
  write(root, "src/lib/security/inbound-org-allowlist.test.ts", 'it("returns 403 when org is not in allowlist", async () => {})\nit("matches UUID case-insensitively", () => {})\n');
  write(root, "src/lib/security/inbound-email-signing.ts", 'export function verifyInboundEmailHmac(params: {\nsecret: string;\nrawBody: string;\nsignatureHeader: string | null;\n}) {\nif (!m) return { ok: false, reason: "missing_or_invalid_signature_format" };\nreturn { ok: false, reason: "signature_mismatch" };\nreturn { ok: true };\n}\n');
  write(root, "src/lib/security/inbound-email-signing.test.ts", 'it("accepts sha256 hex over raw body", () => {})\nit("rejects bad format", () => {})\n');
  write(root, "src/app/api/tasks/from-email/route.ts", 'return isInboundAutomationAuthorized(request, "email");\nconst mac = verifyInboundEmailHmac({\n});\ndiagnostic_id: "email_inbound_signature_invalid",\n`tasks-email:org:${payload.organizationId}`\nconst orgBlocked = inboundOrgNotAllowedResponse(payload.organizationId);\n');
  write(root, "src/app/api/tasks/from-email/route.test.ts", 'it("returns 401 when inbound token is not configured", async () => {})\nit("returns 401 when bearer token does not match", async () => {})\nit("returns 401 for stale email HMAC timestamp", async () => {})\nit("returns 429 when organization rate limit is exceeded", async () => {})\nit("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {})\nit("returns 400 for invalid body when authorized", async () => {})\nit("returns 400 for malformed JSON when authorized", async () => {})\n');
  write(root, "src/app/api/tasks/from-slack/route.ts", 'return isInboundAutomationAuthorized(request, "slack");\nconst sig = verifySlackSigningSecret({\n});\ndiagnostic_id: "slack_inbound_signature_invalid",\n`tasks-slack:org:${body.organizationId}`\nconst orgBlocked = inboundOrgNotAllowedResponse(body.organizationId);\n');
  write(root, "src/app/api/tasks/from-slack/route.test.ts", 'it("returns 401 when inbound token is not configured", async () => {})\nit("returns 401 when bearer token does not match", async () => {})\nit("returns 401 for stale Slack signature timestamp", async () => {})\nit("returns 429 when organization rate limit is exceeded", async () => {})\nit("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {})\nit("returns 400 for malformed JSON when authorized", async () => {})\nit("returns 400 for invalid body when authorized", async () => {})\n');
  write(root, "src/app/api/integrations/actions/callback/route.ts", 'if (!isInboundAutomationAuthorized(request, "integrations_callback")) {\nreturn NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n}\n`inbound:integrations-actions:org:${organizationId}:${String(body.action ?? "unknown")}`\nconst blocked = inboundOrgNotAllowedResponse(organizationId);\nif (!isUuid(organizationId))\n.from("contracts")\n"integration_callback_contract_not_found"\n');
  write(root, "src/app/api/integrations/actions/callback/route.test.ts", 'it("returns 401 when no inbound secret is configured", async () => {})\nit("accepts INBOUND_INTEGRATIONS_CALLBACK_TOKEN instead of shared token", async () => {})\nit("returns 401 when bearer token does not match", async () => {})\nit("returns 429 when organization/action rate limit is exceeded", async () => {})\nit("returns 400 for malformed JSON when authorized", async () => {})\nit("returns 400 for malformed organizationId", async () => {})\nit("rejects create_task when contract is not in the claimed organization", async () => {})\n');

  const report = analyzeInboundIdentityBoundaries(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
