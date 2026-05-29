#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:provider-integration-fixtures"];
const REQUIRED_CI_COMMANDS = ["npm run check:provider-integration-fixtures"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:provider-integration-fixtures"'];
const REQUIRED_MARKERS = {
  "src/lib/provider-integration-fixtures.ts": [
    "REQUIRED_PROVIDER_INTEGRATION_SCENARIOS",
    "checkout_completed",
    "portal_return",
    "webhook_replay",
    "subscription_downgrade",
    "failed_payment",
    "trial_expiry",
    "customer_mismatch",
    "test_live_mismatch",
    "spf_dkim_dmarc_dns",
    "unsubscribe_headers",
    "provider_outage",
    "api_key_absent",
    "quota_error",
    "invalid_model",
    "timeout",
    "partial_output",
    "hallucinated_citation",
    "raw_prompt_leakage",
    "provider_failover",
    "upstash_success",
    "malformed_response",
    "pii_key_sanitization",
    "state_integrity",
    "pkce_s256",
    "token_encryption",
    "reencryption_tooling",
  ],
  "src/lib/provider-integration-fixtures.test.ts": [
    "covers every required provider scenario",
    "reports missing scenarios and unsafe fixture metadata",
  ],
  "src/lib/stripe.ts": [
    "assertStripeEnvironmentConsistency",
    "getExpectedStripeLivemodeFromEnv",
    "Stripe test/live key mismatch",
    "Stripe test mode is not allowed in production",
  ],
  "src/app/api/stripe/webhook/route.ts": [
    "stripe_webhook_livemode_mismatch",
    "billing.payment_failed",
    "stripe_subscription_status: \"past_due\"",
  ],
  "src/lib/email/provider-policy.ts": [
    "EMAIL_AUTH_DNS_EXPECTATION_TYPES",
    "EMAIL_PROVIDER_TIMEOUT_MS",
    "buildListUnsubscribeHeaders",
    "sanitizeEmailProviderFailure",
  ],
  "config/email-auth-dns-fixtures.json": [
    "\"SPF\"",
    "\"DKIM\"",
    "\"DMARC\"",
    "\"MTA-STS\"",
  ],
  "src/lib/extraction/constants.ts": [
    "OPENAI_EXTRACTION_ATTEMPT_TIMEOUT_MS",
    "OPENAI_PDF_OCR_ATTEMPT_TIMEOUT_MS",
  ],
  "src/lib/rate-limit.ts": [
    "normalizeUpstashLimitResult",
    "rate_limit_backend_malformed_response",
    "sanitized-rate-limit-key",
  ],
  "src/app/api/integrations/refresh-tokens/route.ts": [
    "formatUnknownForServerLog(err)",
    "last_error: safeError.slice(0, 500)",
  ],
};

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

export function analyzeProviderIntegrationFixtures(root = ROOT) {
  const issues = [];
  const pkg = JSON.parse(read(root, "package.json") || "{}");
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push(issue("provider_fixtures_missing_package_script", { script }));
  }
  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push(issue("provider_fixtures_missing_ci_command", { cmd }));
  }
  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const marker of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(marker)) {
      issues.push(issue("provider_fixtures_missing_security_pipeline_step", { script: marker.replaceAll('"', "") }));
    }
  }
  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    const text = read(root, rel);
    if (!text) {
      issues.push(issue("provider_fixtures_missing_file", { rel }));
      continue;
    }
    for (const marker of markers) {
      if (!text.includes(marker)) issues.push(issue("provider_fixtures_missing_marker", { rel, marker }));
    }
  }
  return {
    checkId: "provider-integration-fixtures",
    ok: issues.length === 0,
    markerFileCount: Object.keys(REQUIRED_MARKERS).length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeProviderIntegrationFixtures();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
