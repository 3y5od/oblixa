#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_PACKAGE_SCRIPTS = ["check:webhook-inbound-policy"];
const REQUIRED_CI_COMMANDS = ["npm run check:webhook-inbound-policy"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:webhook-inbound-policy"'];

const REQUIRED_MARKERS = {
  "src/app/api/stripe/webhook/route.ts": [
    "readTextBodyLimited(request, STRIPE_WEBHOOK_BODY_MAX)",
    'const signature = request.headers.get("stripe-signature");',
    "STRIPE_WEBHOOK_TOLERANCE_SEC = 300",
    "stripe.webhooks.constructEvent(body, signature, webhookSecret, STRIPE_WEBHOOK_TOLERANCE_SEC)",
    '`stripe-webhook:account:${event.account ?? "platform"}:${event.type}`',
    '.from("stripe_webhook_events")',
    '.insert({ id: event.id, status: "processing" })',
    'if (claimErr.code === "23505")',
    'return jsonOk({ received: true, duplicate: true });',
    'existingOrg?.stripe_customer_id && existingOrg.stripe_customer_id !== customerId',
    'route: ROUTE',
  ],
  "src/app/api/stripe/webhook/route.test.ts": [
    'it("returns 400 when stripe-signature header is missing", async () => {',
    'it("returns 400 when constructEvent rejects (invalid signature)", async () => {',
    'it("returns duplicate payload shape for replayed Stripe event id (out-of-order / at-least-once delivery)", async () => {',
    'it("returns received payload shape when customer.subscription.updated is canceled (terminal)", async () => {',
    'it("does not bind checkout to an org when a valid signature carries a mismatched customer", async () => {',
  ],
  "src/lib/security/slack-signing.ts": [
    "timingSafeEqual(a, b)",
    "const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));",
    "if (ageSec > skew) return { ok: false, reason: \"slack_timestamp_skew\" };",
  ],
  "src/lib/security/slack-signing.test.ts": [
    'it("accepts a valid signature", () => {',
    'it("rejects tampered body", () => {',
    'it("rejects stale timestamp", () => {',
  ],
  "src/lib/security/inbound-email-signing.ts": [
    "timingSafeEqual(a, b)",
    "timestampHeader: string | null;",
    "if (ageSec > skew) return { ok: false, reason: \"timestamp_skew\" };",
    "update(`${timestamp}.${params.rawBody}`)",
  ],
  "src/lib/security/inbound-email-signing.test.ts": [
    'it("accepts sha256 hex over raw body", () => {',
    'it("rejects bad format", () => {',
    'it("rejects stale timestamp", () => {',
  ],
  "src/app/api/tasks/from-slack/route.ts": [
    'return isInboundAutomationAuthorized(request, "slack");',
    "readTextBodyLimited(request, SLACK_INBOUND_BODY_MAX)",
    "verifySlackSigningSecret({",
    'request.headers.get("X-Slack-Request-Timestamp")',
    'return jsonProblem(401, {',
    '.eq("id", body.contractId)',
    '.eq("organization_id", body.organizationId)',
    '`tasks-slack:org:${body.organizationId}`',
    'inboundOrgNotAllowedResponse(body.organizationId)',
    'tasks-slack:event:${body.organizationId}:${body.externalMessageId.trim()}',
    'return jsonOk({ success: true, deduped: true, taskId: existing.data.id });',
  ],
  "src/app/api/tasks/from-slack/route.test.ts": [
    'it("returns 401 when inbound token is not configured", async () => {',
    'it("returns 401 when bearer token does not match", async () => {',
    'it("returns 401 for stale Slack signature timestamp", async () => {',
    'it("returns 429 when organization rate limit is exceeded", async () => {',
    'it("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {',
    'it("returns 400 for malformed JSON when authorized", async () => {',
  ],
  "src/app/api/tasks/from-email/route.ts": [
    'return isInboundAutomationAuthorized(request, "email");',
    "readTextBodyLimited(request, EMAIL_INBOUND_SIGNED_BODY_MAX)",
    "verifyInboundEmailHmac({",
    'request.headers.get("x-oblixa-email-signature")',
    'request.headers.get("x-oblixa-email-timestamp")',
    'return jsonProblem(401, {',
    '.eq("id", payload.contractId)',
    '.eq("organization_id", payload.organizationId)',
    '`tasks-email:org:${payload.organizationId}`',
    'inboundOrgNotAllowedResponse(payload.organizationId)',
    'tasks-email:event:${payload.organizationId}:${payload.externalMessageId.trim()}',
    'return jsonOk({ success: true, deduped: true, taskId: existing.data.id });',
  ],
  "src/app/api/tasks/from-email/route.test.ts": [
    'it("returns 401 when inbound token is not configured", async () => {',
    'it("returns 401 when bearer token does not match", async () => {',
    'it("returns 401 for stale email HMAC timestamp", async () => {',
    'it("returns 429 when organization rate limit is exceeded", async () => {',
    'it("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {',
    'it("returns 400 for malformed JSON when authorized", async () => {',
  ],
  "src/app/api/integrations/actions/callback/route.ts": [
    'isInboundAutomationAuthorized(request, "integrations_callback")',
    '`inbound:integrations-actions:org:${organizationId}:${String(body.action ?? "unknown")}`',
    'inboundOrgNotAllowedResponse(organizationId)',
    '.from("contracts")',
    '.eq("organization_id", organizationId)',
    '"integration_callback_contract_not_found"',
    'return jsonNotFound(ROUTE);',
  ],
  "src/app/api/integrations/actions/callback/route.test.ts": [
    'it("returns 401 when no inbound secret is configured", async () => {',
    'it("returns 401 when bearer token does not match", async () => {',
    'it("returns 429 when organization/action rate limit is exceeded", async () => {',
    'it("returns 400 for malformed JSON when authorized", async () => {',
    'it("returns 400 for malformed organizationId", async () => {',
    'it("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {',
    'it("rejects create_task when contract is not in the claimed organization", async () => {',
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzeWebhookInboundPolicy(root = ROOT) {
  const issues = [];

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

  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const source = read(root, rel);
    for (const marker of markers) {
      if (!source.includes(marker)) issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "webhook-inbound-policy", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeWebhookInboundPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
