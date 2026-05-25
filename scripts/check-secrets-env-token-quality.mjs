#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:secrets-env-token-quality", "tools:reencrypt-integration-tokens"];
const REQUIRED_CI_COMMANDS = [
  "npm run check:secrets-env-token-quality",
  "npm run check:security-env-contract",
  "npm run check:next-public-surface",
  "npm run check:client-bundle-secret-leakage",
  "npm run check:token-security-quality",
];
const REQUIRED_SECURITY_PIPELINE_STEPS = [
  '"check:secrets-env-token-quality"',
  '"check:security-env-contract"',
  '"check:token-security-quality"',
];
const REQUIRED_ENV_EXAMPLE_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "CRON_SECRET_PREVIOUS",
  "CRON_SECRET_PREVIOUS_EXPIRES_AT",
  "OBLIXA_INTERNAL_HMAC_SECRET",
  "OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET",
  "OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT",
  "OBLIXA_MALWARE_SCANNER_MODE",
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "EXTERNAL_ACTION_PASSCODE_PEPPER",
  "EXTERNAL_ACTION_SUBMIT_TICKET_SECRET",
  "EXTRACTION_WORKER_SECRET",
  "OBLIXA_INTERNAL_DIAG_SECRET",
  "INBOUND_AUTOMATION_TOKEN_PREVIOUS",
  "INBOUND_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
  "INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS",
  "INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
  "INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS",
  "INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT",
  "INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS",
  "INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS_EXPIRES_AT",
  "OBLIXA_STEP_UP_SECRET",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
  "OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID",
  "OBLIXA_TOKEN_ENCRYPTION_KEY_DEFAULT",
];
const REQUIRED_FILE_MARKERS = {
  "src/lib/observability/instrumentation-env-warn.ts": [
    "export function listStrictProductionSecretDeficits(",
    "export function listSuspiciousNextPublicKeys(",
    "export function listWeakProductionSecretFindings(",
    "SECURITY_SECRET_KEYS",
    "OBLIXA_STEP_UP_SECRET",
    "isProductionLikeSecretEnv",
  ],
  "src/lib/observability/instrumentation-env-warn.test.ts": [
    "listStrictProductionSecretDeficits",
    "listWeakProductionSecretFindings",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
  ],
  "src/lib/env/server.ts": [
    "export function requireServerEnv",
    "export function getSupabaseServiceRoleKey",
    "INTEGRATION_TOKEN_ENCRYPTION_KEY",
  ],
  "src/lib/env/server.test.ts": [
    "service-role key is missing",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  "src/lib/security/cron-route-gate.ts": [
    "respondCronMissingEnv",
    "cron_secret_missing",
    "missing_env: \"CRON_SECRET\"",
    "CRON_SECRET_PREVIOUS",
    "CRON_SECRET_PREVIOUS_EXPIRES_AT",
  ],
  "src/lib/security/internal-hmac.ts": [
    "INTERNAL_HMAC_SIGNATURE_HEADER",
    "INTERNAL_HMAC_TIMESTAMP_HEADER",
    "INTERNAL_HMAC_BODY_SHA256_HEADER",
    "INTERNAL_HMAC_KEY_ID_HEADER",
    "INTERNAL_HMAC_PREVIOUS_SECRET_EXPIRES_AT_ENV",
    "OBLIXA_INTERNAL_HMAC",
    "verifyInternalHmacRequest",
    "previous_secret_expired",
  ],
  "src/lib/security/internal-hmac.test.ts": [
    "accepts previous secret during rotation",
    "previous_secret_expiry_required",
    "previous_secret_expired",
    "rejects stale timestamps and tampered bodies",
  ],
  "src/lib/security/upload-scan.ts": [
    "OBLIXA_MALWARE_SCANNER_MODE",
    "scanUploadedFileForMalware",
    "scanner_unavailable",
  ],
  "src/lib/security/api-guards.test.ts": [
    "503 when CRON_SECRET unset",
    "requireBearerSecret",
  ],
  "src/lib/security/secret-compare.ts": [
    "timingSafeEqual",
    "createHash(\"sha256\")",
    "parseBearerToken",
  ],
  "src/lib/security/secret-compare.test.ts": [
    "compares different lengths without throwing",
    "digest-length timingSafeEqual semantics",
  ],
  "src/lib/security/token-crypto.ts": [
    "TOKEN_PREFIX_V2",
    "activeTokenKeyId",
    "OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID",
    "OBLIXA_TOKEN_ENCRYPTION_KEY_",
    "Legacy plaintext integration token rejected in production",
  ],
  "src/lib/security/token-crypto.test.ts": [
    "emits versioned token envelopes with explicit key ids",
    "decryptIntegrationToken rejects legacy plaintext in production",
  ],
  "scripts/reencrypt-integration-tokens.mjs": [
    "planIntegrationTokenReencryption",
    "--write",
    "integration_connections",
    "access_token",
    "refresh_token",
    "OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID",
  ],
  "scripts/reencrypt-integration-tokens.test.mjs": [
    "dry-runs plaintext and old envelopes into active v2 kid",
    "skips already-active envelopes",
  ],
  "src/lib/operational-contracts.ts": [
    "V10_PROVIDER_BOUNDARIES",
    "requiredServerEnv",
    "publicEnvAllowed",
    "buildV10ProviderReadinessSnapshot",
  ],
  "src/lib/operational-contracts.test.ts": [
    "hardens provider configuration and public/private environment boundaries",
    "server_secret_must_not_be_public",
    "releaseBlockerWhenMissing: true",
  ],
  "src/app/api/export/calendar/feed/route.ts": [
    "randomBytes(32).toString(\"hex\")",
    "token_hash",
    "expires_at",
  ],
  "scripts/check-token-security-quality.mjs": [
    "missing_expiry_or_freshness_guard",
    "missing_constant_time_or_verified_token_check",
  ],
  "scripts/check-tracked-secrets-hygiene.mjs": [
    "analyzeTrackedSecretsHygiene",
    "missing_gitignore_env_pattern",
    "unsafe_env_unignore_pattern",
    "env_example_secret_value_must_be_empty",
  ],
  "scripts/check-tracked-secrets-hygiene.test.mjs": [
    "rejects tracked env, key, and coverage files",
    "rejects missing or unsafe env ignore rules",
    "rejects real-looking .env.example secret values",
  ],
  "scripts/check-test-fixture-secrets.mjs": [
    "SECRET_REVIEW_ROOTS",
    "docs",
    "artifacts",
    ".github",
  ],
  "scripts/check-test-fixture-secrets.test.mjs": [
    "scans docs, artifacts, and workflows",
    "honors explicit placeholder allow markers",
  ],
  "scripts/check-next-public-surface.mjs": ["NEXT_PUBLIC_"],
  "scripts/check-client-bundle-secret-leakage.mjs": [
    "analyzeClientBundleSecretLeakage",
    "server_env_in_client_bundle",
    "sensitive_next_public_env",
  ],
  "scripts/check-security-env-contract.mjs": ["REQUIRED_ENV_KEYS"],
  "src/lib/observability/sentry-scrub.test.ts": ["redacts API keys, cookies, and inbound automation tokens"],
  "src/lib/hardening-contracts.ts": ["token|secret|private.?url"],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function parseEnvExampleKeys(text) {
  const keys = new Set();
  for (const match of text.matchAll(/^\s*#?\s*([A-Z0-9_]+)=/gm)) keys.add(match[1]);
  return keys;
}

export function analyzeSecretsEnvTokenQuality(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) issues.push({ issue: "missing_required_file", rel });
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
    if (!securityPipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }
  const envKeys = parseEnvExampleKeys(read(root, ".env.example"));
  for (const key of REQUIRED_ENV_EXAMPLE_KEYS) {
    if (!envKeys.has(key)) issues.push({ issue: "missing_env_example_key", key });
  }
  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) issues.push({ issue: "missing_marker", rel, marker });
  }
  return { checkId: "secrets-env-token-quality", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSecretsEnvTokenQuality();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
