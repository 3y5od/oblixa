#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:inbound-identity-boundaries"];
const REQUIRED_CI_COMMANDS = ["npm run check:inbound-identity-boundaries"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:inbound-identity-boundaries"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/inbound-automation-token.ts": [
    "export function getInboundAutomationSecrets(",
    "INBOUND_AUTOMATION_TOKEN_PREVIOUS",
    "INBOUND_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
    "INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS",
    "INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
    "INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS",
    "INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
    "INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS",
    "INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS_EXPIRES_AT",
    "validatePreviousSecretExpiry",
    "export function isInboundAutomationAuthorized(",
    'const expectedSecrets = getInboundAutomationSecrets(route);',
    'const auth = parseBearerToken(request.headers.get("authorization"));',
    "expectedSecrets.some((expected) => secureCompareUtf8(auth, expected))",
  ],
  "src/lib/security/inbound-automation-token.test.ts": [
    'it("uses route-specific secret when set"',
    'it("isInboundAutomationAuthorized returns true for matching bearer"',
    'it("isInboundAutomationAuthorized returns false for wrong token"',
    'it("rejects shared token when a route-specific secret is configured"',
    'it("accepts previous route-specific and shared tokens during rotation"',
    'it("rejects expired previous inbound tokens during rotation"',
  ],
  "src/lib/security/inbound-org-allowlist.ts": [
    'export function inboundOrgNotAllowedResponse(organizationId: string): NextResponse | null {',
    'return NextResponse.json({ error: "organizationId is required" }, { status: 400 });',
    '{ error: "Organization not permitted for inbound automation" },',
  ],
  "src/lib/security/inbound-org-allowlist.test.ts": [
    'it("returns 403 when org is not in allowlist"',
    'it("matches UUID case-insensitively"',
  ],
  "src/lib/security/inbound-email-signing.ts": [
    'export function verifyInboundEmailHmac(params: {',
    'if (!m) return { ok: false, reason: "missing_or_invalid_signature_format" };',
    'return { ok: false, reason: "signature_mismatch" };',
    'return { ok: true };',
  ],
  "src/lib/security/inbound-email-signing.test.ts": [
    'it("accepts sha256 hex over raw body"',
    'it("rejects bad format"',
  ],
  "src/app/api/tasks/from-email/route.ts": [
    'return isInboundAutomationAuthorized(request, "email");',
    'const mac = verifyInboundEmailHmac({',
    'diagnostic_id: "email_inbound_signature_invalid",',
    '`tasks-email:org:${payload.organizationId}`',
    'const orgBlocked = inboundOrgNotAllowedResponse(payload.organizationId);',
  ],
  "src/app/api/tasks/from-email/route.test.ts": [
    'it("returns 401 when inbound token is not configured"',
    'it("returns 401 when bearer token does not match"',
    'it("returns 401 for stale email HMAC timestamp"',
    'it("returns 429 when organization rate limit is exceeded"',
    'it("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST"',
    'it("returns 400 for invalid body when authorized"',
    'it("returns 400 for malformed JSON when authorized"',
  ],
  "src/app/api/tasks/from-slack/route.ts": [
    'return isInboundAutomationAuthorized(request, "slack");',
    'const sig = verifySlackSigningSecret({',
    'diagnostic_id: "slack_inbound_signature_invalid",',
    '`tasks-slack:org:${body.organizationId}`',
    'const orgBlocked = inboundOrgNotAllowedResponse(body.organizationId);',
  ],
  "src/app/api/tasks/from-slack/route.test.ts": [
    'it("returns 401 when inbound token is not configured"',
    'it("returns 401 when bearer token does not match"',
    'it("returns 401 for stale Slack signature timestamp"',
    'it("returns 429 when organization rate limit is exceeded"',
    'it("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST"',
    'it("returns 400 for malformed JSON when authorized"',
    'it("returns 400 for invalid body when authorized"',
  ],
  "src/app/api/integrations/actions/callback/route.ts": [
    'if (!isInboundAutomationAuthorized(request, "integrations_callback")) {',
    '`inbound:integrations-actions:org:${organizationId}:${String(body.action ?? "unknown")}`',
    'const blocked = inboundOrgNotAllowedResponse(organizationId);',
    'if (!isUuid(organizationId))',
    '.from("contracts")',
    '"integration_callback_contract_not_found"',
  ],
  "src/app/api/integrations/actions/callback/route.test.ts": [
    'it("returns 401 when no inbound secret is configured"',
    'it("accepts INBOUND_INTEGRATIONS_CALLBACK_TOKEN instead of shared token"',
    'it("returns 401 when bearer token does not match"',
    'it("returns 429 when organization/action rate limit is exceeded"',
    'it("returns 400 for malformed JSON when authorized"',
    'it("returns 400 for malformed organizationId"',
    'it("rejects create_task when contract is not in the claimed organization"',
  ],
};

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeInboundIdentityBoundaries(root = ROOT) {
  const issues = [];

  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "inbound-identity-boundaries", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeInboundIdentityBoundaries();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
