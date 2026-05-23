import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeWebhookInboundPolicy } from "./check-webhook-inbound-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeWebhookInboundPolicy validates signed inbound controls", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-webhook-inbound-policy-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:webhook-inbound-policy": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:webhook-inbound-policy\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:webhook-inbound-policy"\n');
  write(root, "src/app/api/stripe/webhook/route.ts", 'readTextBodyLimited(request, STRIPE_WEBHOOK_BODY_MAX)\nconst signature = request.headers.get("stripe-signature");\nSTRIPE_WEBHOOK_TOLERANCE_SEC = 300\nstripe.webhooks.constructEvent(body, signature, webhookSecret, STRIPE_WEBHOOK_TOLERANCE_SEC)\n`stripe-webhook:account:${event.account ?? "platform"}:${event.type}`\n.from("stripe_webhook_events")\n.insert({ id: event.id, status: "processing" })\nif (claimErr.code === "23505")\nreturn jsonOk({ received: true, duplicate: true });\nexistingOrg?.stripe_customer_id && existingOrg.stripe_customer_id !== customerId\nroute: ROUTE\n');
  write(root, "src/app/api/stripe/webhook/route.test.ts", 'it("returns 400 when stripe-signature header is missing", async () => {})\nit("returns 400 when constructEvent rejects (invalid signature)", async () => {})\nit("returns duplicate payload shape for replayed Stripe event id (out-of-order / at-least-once delivery)", async () => {})\nit("returns received payload shape when customer.subscription.updated is canceled (terminal)", async () => {})\nit("does not bind checkout to an org when a valid signature carries a mismatched customer", async () => {})\n');
  write(root, "src/lib/security/slack-signing.ts", 'timingSafeEqual(a, b)\nconst ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));\nif (ageSec > skew) return { ok: false, reason: "slack_timestamp_skew" };\n');
  write(root, "src/lib/security/slack-signing.test.ts", 'it("accepts a valid signature", () => {})\nit("rejects tampered body", () => {})\nit("rejects stale timestamp", () => {})\n');
  write(root, "src/lib/security/inbound-email-signing.ts", 'timingSafeEqual(a, b)\ntimestampHeader: string | null;\nif (ageSec > skew) return { ok: false, reason: "timestamp_skew" };\nupdate(`${timestamp}.${params.rawBody}`)\n');
  write(root, "src/lib/security/inbound-email-signing.test.ts", 'it("accepts sha256 hex over raw body", () => {})\nit("rejects bad format", () => {})\nit("rejects stale timestamp", () => {})\n');
  write(root, "src/app/api/tasks/from-slack/route.ts", 'return isInboundAutomationAuthorized(request, "slack");\nreadTextBodyLimited(request, SLACK_INBOUND_BODY_MAX)\nverifySlackSigningSecret({\nrequest.headers.get("X-Slack-Request-Timestamp")\nreturn jsonProblem(401, {\n.eq("id", body.contractId)\n.eq("organization_id", body.organizationId)\n`tasks-slack:org:${body.organizationId}`\ninboundOrgNotAllowedResponse(body.organizationId)\ntasks-slack:event:${body.organizationId}:${body.externalMessageId.trim()}\nreturn jsonOk({ success: true, deduped: true, taskId: existing.data.id });\n');
  write(root, "src/app/api/tasks/from-slack/route.test.ts", 'it("returns 401 when inbound token is not configured", async () => {})\nit("returns 401 when bearer token does not match", async () => {})\nit("returns 401 for stale Slack signature timestamp", async () => {})\nit("returns 429 when organization rate limit is exceeded", async () => {})\nit("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {})\nit("returns 400 for malformed JSON when authorized", async () => {})\n');
  write(root, "src/app/api/tasks/from-email/route.ts", 'return isInboundAutomationAuthorized(request, "email");\nreadTextBodyLimited(request, EMAIL_INBOUND_SIGNED_BODY_MAX)\nverifyInboundEmailHmac({\nrequest.headers.get("x-oblixa-email-signature")\nrequest.headers.get("x-oblixa-email-timestamp")\nreturn jsonProblem(401, {\n.eq("id", payload.contractId)\n.eq("organization_id", payload.organizationId)\n`tasks-email:org:${payload.organizationId}`\ninboundOrgNotAllowedResponse(payload.organizationId)\ntasks-email:event:${payload.organizationId}:${payload.externalMessageId.trim()}\nreturn jsonOk({ success: true, deduped: true, taskId: existing.data.id });\n');
  write(root, "src/app/api/tasks/from-email/route.test.ts", 'it("returns 401 when inbound token is not configured", async () => {})\nit("returns 401 when bearer token does not match", async () => {})\nit("returns 401 for stale email HMAC timestamp", async () => {})\nit("returns 429 when organization rate limit is exceeded", async () => {})\nit("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {})\nit("returns 400 for malformed JSON when authorized", async () => {})\n');
  write(root, "src/app/api/integrations/actions/callback/route.ts", 'isInboundAutomationAuthorized(request, "integrations_callback")\n`inbound:integrations-actions:org:${organizationId}:${String(body.action ?? "unknown")}`\ninboundOrgNotAllowedResponse(organizationId)\n.from("contracts")\n.eq("organization_id", organizationId)\n"integration_callback_contract_not_found"\nreturn jsonNotFound(ROUTE);\n');
  write(root, "src/app/api/integrations/actions/callback/route.test.ts", 'it("returns 401 when no inbound secret is configured", async () => {})\nit("returns 401 when bearer token does not match", async () => {})\nit("returns 429 when organization/action rate limit is exceeded", async () => {})\nit("returns 400 for malformed JSON when authorized", async () => {})\nit("returns 400 for malformed organizationId", async () => {})\nit("returns 403 when organization is not in INBOUND_AUTOMATION_ORG_ALLOWLIST", async () => {})\nit("rejects create_task when contract is not in the claimed organization", async () => {})\n');

  const report = analyzeWebhookInboundPolicy(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
