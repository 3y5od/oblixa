import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeProviderIntegrationFixtures } from "./check-provider-integration-fixtures.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeProviderIntegrationFixtures validates package, CI, pipeline, and required markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-provider-fixtures-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:provider-integration-fixtures": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:provider-integration-fixtures\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:provider-integration-fixtures"\n');
  write(root, "src/lib/provider-integration-fixtures.ts", "REQUIRED_PROVIDER_INTEGRATION_SCENARIOS checkout_completed portal_return webhook_replay subscription_downgrade failed_payment trial_expiry customer_mismatch test_live_mismatch spf_dkim_dmarc_dns unsubscribe_headers provider_outage api_key_absent quota_error invalid_model timeout partial_output hallucinated_citation raw_prompt_leakage provider_failover upstash_success malformed_response pii_key_sanitization state_integrity pkce_s256 token_encryption reencryption_tooling");
  write(root, "src/lib/provider-integration-fixtures.test.ts", "covers every required provider scenario\nreports missing scenarios and unsafe fixture metadata\n");
  write(root, "src/lib/stripe.ts", "assertStripeEnvironmentConsistency\ngetExpectedStripeLivemodeFromEnv\nStripe test/live key mismatch\nStripe test mode is not allowed in production\n");
  write(root, "src/app/api/stripe/webhook/route.ts", "stripe_webhook_livemode_mismatch\nbilling.payment_failed\nstripe_subscription_status: \"past_due\"\n");
  write(root, "src/lib/email/provider-policy.ts", "EMAIL_AUTH_DNS_EXPECTATION_TYPES\nEMAIL_PROVIDER_TIMEOUT_MS\nbuildListUnsubscribeHeaders\nsanitizeEmailProviderFailure\n");
  write(root, "config/email-auth-dns-fixtures.json", "\"SPF\"\n\"DKIM\"\n\"DMARC\"\n\"MTA-STS\"\n");
  write(root, "src/lib/extraction/constants.ts", "OPENAI_EXTRACTION_ATTEMPT_TIMEOUT_MS\nOPENAI_PDF_OCR_ATTEMPT_TIMEOUT_MS\n");
  write(root, "src/lib/rate-limit.ts", "normalizeUpstashLimitResult\nrate_limit_backend_malformed_response\nsanitized-rate-limit-key\n");
  write(root, "src/app/api/integrations/refresh-tokens/route.ts", "formatUnknownForServerLog(err)\nlast_error: safeError.slice(0, 500)\n");

  const report = analyzeProviderIntegrationFixtures(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
