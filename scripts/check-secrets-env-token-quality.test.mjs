import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSecretsEnvTokenQuality } from "./check-secrets-env-token-quality.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:secrets-env-token-quality": "x", "tools:reencrypt-integration-tokens": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:secrets-env-token-quality\nnpm run check:security-env-contract\nnpm run check:next-public-surface\nnpm run check:client-bundle-secret-leakage\nnpm run check:token-security-quality\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:secrets-env-token-quality"\n"check:security-env-contract"\n"check:token-security-quality"\n');
  write(root, ".env.example", "SUPABASE_SERVICE_ROLE_KEY=\nCRON_SECRET=\nCRON_SECRET_PREVIOUS=\nCRON_SECRET_PREVIOUS_EXPIRES_AT=\nOBLIXA_INTERNAL_HMAC_SECRET=\nOBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET=\nOBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT=\nOBLIXA_MALWARE_SCANNER_MODE=\nRESEND_API_KEY=\nOPENAI_API_KEY=\nSTRIPE_SECRET_KEY=\nSTRIPE_WEBHOOK_SECRET=\nSTRIPE_WEBHOOK_SECRET_PREVIOUS=\nSTRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT=\nEXTERNAL_ACTION_PASSCODE_PEPPER=\nEXTERNAL_ACTION_SUBMIT_TICKET_SECRET=\nEXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS=\nEXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS_EXPIRES_AT=\nEXTRACTION_WORKER_SECRET=\nOBLIXA_INTERNAL_DIAG_SECRET=\nINBOUND_AUTOMATION_TOKEN_PREVIOUS=\nINBOUND_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT=\nINBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS=\nINBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT=\nINBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS=\nINBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT=\nINBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS=\nINBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS_EXPIRES_AT=\nOBLIXA_STEP_UP_SECRET=\nINTEGRATION_TOKEN_ENCRYPTION_KEY=\nOBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID=\nOBLIXA_TOKEN_ENCRYPTION_KEY_DEFAULT=\n");
  write(root, "src/lib/observability/instrumentation-env-warn.ts", "export function listStrictProductionSecretDeficits(\nexport function listSuspiciousNextPublicKeys(\nexport function listWeakProductionSecretFindings(\nSECURITY_SECRET_KEYS\nOBLIXA_STEP_UP_SECRET\nisProductionLikeSecretEnv\n");
  write(root, "src/lib/observability/instrumentation-env-warn.test.ts", "listStrictProductionSecretDeficits\nlistWeakProductionSecretFindings\nSUPABASE_SERVICE_ROLE_KEY\nCRON_SECRET\nOBLIXA_STEP_UP_SECRET\n");
  write(root, "src/lib/env/server.ts", "export function requireServerEnv\nexport function getSupabaseServiceRoleKey\nINTEGRATION_TOKEN_ENCRYPTION_KEY\n");
  write(root, "src/lib/env/server.test.ts", "service-role key is missing\nSUPABASE_SERVICE_ROLE_KEY\n");
  write(root, "src/lib/security/cron-route-gate.ts", "respondCronMissingEnv\ncron_secret_missing\nmissing_env: \"CRON_SECRET\"\nCRON_SECRET_PREVIOUS\nCRON_SECRET_PREVIOUS_EXPIRES_AT\n");
  write(root, "src/lib/security/internal-hmac.ts", "INTERNAL_HMAC_SIGNATURE_HEADER\nINTERNAL_HMAC_TIMESTAMP_HEADER\nINTERNAL_HMAC_BODY_SHA256_HEADER\nINTERNAL_HMAC_KEY_ID_HEADER\nINTERNAL_HMAC_PREVIOUS_SECRET_EXPIRES_AT_ENV\nOBLIXA_INTERNAL_HMAC\nverifyInternalHmacRequest\nprevious_secret_expired\n");
  write(root, "src/lib/security/internal-hmac.test.ts", "accepts previous secret during rotation\nprevious_secret_expiry_required\nprevious_secret_expired\nrejects stale timestamps and tampered bodies\n");
  write(root, "src/lib/security/upload-scan.ts", "OBLIXA_MALWARE_SCANNER_MODE\nscanUploadedFileForMalware\nscanner_unavailable\n");
  write(root, "src/lib/security/api-guards.test.ts", "503 when CRON_SECRET unset\nrequireBearerSecret\n");
  write(root, "src/lib/security/secret-compare.ts", "timingSafeEqual\ncreateHash(\"sha256\")\nparseBearerToken\n");
  write(root, "src/lib/security/secret-compare.test.ts", "compares different lengths without throwing\ndigest-length timingSafeEqual semantics\n");
  write(root, "src/lib/security/token-crypto.ts", "TOKEN_PREFIX_V2\nactiveTokenKeyId\nOBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID\nOBLIXA_TOKEN_ENCRYPTION_KEY_\nLegacy plaintext integration token rejected in production\n");
  write(root, "src/lib/security/token-crypto.test.ts", "emits versioned token envelopes with explicit key ids\ndecryptIntegrationToken rejects legacy plaintext in production\n");
  write(root, "src/lib/decision-intelligence/api.ts", "EXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS\nEXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS_EXPIRES_AT\nrotatingSecretCandidates\n");
  write(root, "src/lib/decision-intelligence/api.external.test.ts", "accepts previous submit-ticket secret during bounded rotation\nrejects expired previous submit-ticket secret during rotation\n");
  write(root, "src/app/api/stripe/webhook/route.ts", "STRIPE_WEBHOOK_SECRET_PREVIOUS\nSTRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT\nrotatingSecretCandidates\n");
  write(root, "src/app/api/stripe/webhook/route.test.ts", "accepts a valid previous Stripe webhook secret during bounded rotation\nrejects an expired previous Stripe webhook secret during rotation\n");
  write(root, "scripts/reencrypt-integration-tokens.mjs", "planIntegrationTokenReencryption\n--write\nintegration_connections\naccess_token\nrefresh_token\nOBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID\n");
  write(root, "scripts/reencrypt-integration-tokens.test.mjs", "dry-runs plaintext and old envelopes into active v2 kid\nskips already-active envelopes\n");
  write(root, "src/lib/operational-contracts.ts", "V10_PROVIDER_BOUNDARIES\nrequiredServerEnv\npublicEnvAllowed\nbuildV10ProviderReadinessSnapshot\n");
  write(root, "src/lib/operational-contracts.test.ts", "hardens provider configuration and public/private environment boundaries\nserver_secret_must_not_be_public\nreleaseBlockerWhenMissing: true\n");
  write(root, "src/app/api/export/calendar/feed/route.ts", "randomBytes(32).toString(\"hex\")\ntoken_hash\nexpires_at\n");
  write(root, "scripts/check-token-security-quality.mjs", "missing_expiry_or_freshness_guard\nmissing_constant_time_or_verified_token_check\n");
  write(root, "scripts/check-tracked-secrets-hygiene.mjs", "analyzeTrackedSecretsHygiene\nmissing_gitignore_env_pattern\nunsafe_env_unignore_pattern\nenv_example_secret_value_must_be_empty\n");
  write(root, "scripts/check-tracked-secrets-hygiene.test.mjs", "rejects tracked env, key, and coverage files\nrejects missing or unsafe env ignore rules\nrejects real-looking .env.example secret values\n");
  write(root, "scripts/check-test-fixture-secrets.mjs", "SECRET_REVIEW_ROOTS\ndocs\nartifacts\n.github\n");
  write(root, "scripts/check-test-fixture-secrets.test.mjs", "scans docs, artifacts, and workflows\nhonors explicit placeholder allow markers\n");
  write(root, "scripts/check-next-public-surface.mjs", "NEXT_PUBLIC_\n");
  write(root, "scripts/check-client-bundle-secret-leakage.mjs", "analyzeClientBundleSecretLeakage\nserver_env_in_client_bundle\nsensitive_next_public_env\n");
  write(root, "scripts/check-security-env-contract.mjs", "REQUIRED_ENV_KEYS\n");
  write(root, "src/lib/observability/sentry-scrub.test.ts", "redacts API keys, cookies, and inbound automation tokens\n");
  write(root, "src/lib/hardening-contracts.ts", "token|secret|private.?url\n");
}

test("analyzeSecretsEnvTokenQuality accepts complete Section 17 fixture", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-secrets-env-"));
  writeValidFixture(root);
  const report = analyzeSecretsEnvTokenQuality(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeSecretsEnvTokenQuality rejects missing weak-secret and service-role markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-secrets-env-bad-"));
  writeValidFixture(root);
  write(root, "src/lib/observability/instrumentation-env-warn.ts", "export function listStrictProductionSecretDeficits(\nexport function listSuspiciousNextPublicKeys(\n");
  write(root, "src/lib/env/server.test.ts", "SUPABASE_SERVICE_ROLE_KEY\n");
  const report = analyzeSecretsEnvTokenQuality(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "missing_marker" && i.rel === "src/lib/observability/instrumentation-env-warn.ts"));
  assert(report.issues.some((i) => i.issue === "missing_marker" && i.rel === "src/lib/env/server.test.ts"));
});
