import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeReleaseSecurityRequiredEnv } from "./check-release-security-required-env.mjs";

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-release-env-"));
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(root, "artifacts", "zap-baseline.json"), JSON.stringify({ rules: [] }));
  return root;
}

const TOKEN_ENCRYPTION_KEY = Buffer.from("12345678901234567890123456789012").toString("base64");

function strictEnv(overrides = {}) {
  return {
    OBLIXA_RELEASE_SECURITY_STRICT: "1",
    RLS_SMOKE_DATABASE_URL: "postgres://user:pass@example.test/db",
    STAGING_BASE_URL: "https://staging.example.test",
    E2E_TEST_EMAIL: "security@example.test",
    E2E_TEST_PASSWORD: "test-password",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "upstash-token-12345678901234567890",
    SUPABASE_SERVICE_ROLE_KEY: "eyJservice.role.release.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJanon.release.test",
    CRON_SECRET: "cron-secret-123456789012345678901",
    OBLIXA_INTERNAL_HMAC_SECRET: "hmac-secret-123456789012345678901",
    OBLIXA_STEP_UP_SECRET: "step-up-secret-12345678901234567890",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123456789012345678901234",
    STRIPE_SECRET_KEY: "sk_test_123456789012345678901234",
    STRIPE_WEBHOOK_SECRET: "whsec_12345678901234567890123456", // security:test-fixture-secret-placeholder
    RESEND_API_KEY: "re_123456789012345678901234567890",
    OPENAI_API_KEY: "sk-proj-123456789012345678901234",
    SENTRY_DSN: "https://public@sentry.example.test/1",
    NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.example.test/1",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: TOKEN_ENCRYPTION_KEY,
    ...overrides,
  };
}

test("advisory mode does not require release-only credentials", () => {
  const report = analyzeReleaseSecurityRequiredEnv({ env: {}, root: makeRoot(), nowMs: Date.parse("2026-01-01T00:00:00Z") });
  assert.equal(report.ok, true);
  assert.equal(report.mode, "advisory");
});

test("strict mode fails closed for missing release security prerequisites", () => {
  const report = analyzeReleaseSecurityRequiredEnv({
    env: { OBLIXA_RELEASE_SECURITY_STRICT: "1" },
    root: makeRoot(),
    nowMs: Date.parse("2026-01-01T00:00:00Z"),
  });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_required_env_group" && issue.reason === "strict_release_requires_live_rls_smoke_database_url"));
  assert(report.issues.some((issue) => issue.issue === "missing_dast_target"));
  assert(report.issues.some((issue) => issue.issue === "missing_required_env" && issue.key === "E2E_TEST_EMAIL"));
  assert(report.issues.some((issue) => issue.issue === "missing_required_env" && issue.key === "UPSTASH_REDIS_REST_URL"));
  assert(report.issues.some((issue) => issue.issue === "missing_required_env" && issue.key === "OBLIXA_INTERNAL_HMAC_SECRET"));
});

test("strict mode accepts explicit local DAST target as a staged alternative", () => {
  const report = analyzeReleaseSecurityRequiredEnv({
    env: strictEnv({
      STAGING_BASE_URL: "",
      DAST_TARGET_MODE: "local",
      DAST_LOCAL_BASE_URL: "http://127.0.0.1:3000",
    }),
    root: makeRoot(),
    nowMs: Date.parse("2026-01-01T00:00:00Z"),
  });

  assert.equal(report.ok, true);
});

test("strict mode requires previous secrets to have future ISO expiry metadata", () => {
  const report = analyzeReleaseSecurityRequiredEnv({
    env: strictEnv({
      CRON_SECRET_PREVIOUS: "previous-cron",
      CRON_SECRET_PREVIOUS_EXPIRES_AT: "2025-01-01T00:00:00.000Z",
      OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET: "previous-hmac",
    }),
    root: makeRoot(),
    nowMs: Date.parse("2026-01-01T00:00:00Z"),
  });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.secretKey === "CRON_SECRET_PREVIOUS" && issue.reason === "expired"));
  assert(report.issues.some((issue) => issue.secretKey === "OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET" && issue.reason === "missing"));
});

test("strict mode accepts previous secrets with future ISO expiry metadata", () => {
  const report = analyzeReleaseSecurityRequiredEnv({
    env: strictEnv({
      CRON_SECRET_PREVIOUS: "previous-cron",
      CRON_SECRET_PREVIOUS_EXPIRES_AT: "2026-02-01T00:00:00.000Z",
      OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET: "previous-hmac",
      OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT: "2026-02-01T00:00:00.000Z",
    }),
    root: makeRoot(),
    nowMs: Date.parse("2026-01-01T00:00:00Z"),
  });

  assert.equal(report.ok, true);
});

test("strict mode rejects malformed provider URLs, bad prefixes, and invalid encryption keys", () => {
  const report = analyzeReleaseSecurityRequiredEnv({
    env: strictEnv({
      NEXT_PUBLIC_APP_URL: "not a url",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "sk_test_wrong_public_key",
      STRIPE_SECRET_KEY: "sk_live_123456789012345678901234", // security:test-fixture-secret-placeholder
      RESEND_API_KEY: "bad-resend-key",
      INTEGRATION_TOKEN_ENCRYPTION_KEY: "not-base64",
    }),
    root: makeRoot(),
    nowMs: Date.parse("2026-01-01T00:00:00Z"),
  });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "malformed_url_env" && issue.key === "NEXT_PUBLIC_APP_URL"));
  assert(report.issues.some((issue) => issue.issue === "invalid_key_prefix" && issue.key === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"));
  assert(report.issues.some((issue) => issue.issue === "invalid_key_prefix" && issue.key === "RESEND_API_KEY"));
  assert(report.issues.some((issue) => issue.issue === "mixed_stripe_key_modes"));
  assert(report.issues.some((issue) => issue.issue === "invalid_integration_token_encryption_key"));
});

test("strict mode rejects obvious production release mixed with staging or test credentials", () => {
  const report = analyzeReleaseSecurityRequiredEnv({
    env: strictEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://staging.example.test",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123456789012345678901234",
      STRIPE_SECRET_KEY: "sk_test_123456789012345678901234",
    }),
    root: makeRoot(),
    nowMs: Date.parse("2026-01-01T00:00:00Z"),
  });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "mixed_environment_credentials" && issue.provider === "stripe"));
  assert(report.issues.some((issue) => issue.issue === "mixed_environment_credentials" && issue.key === "NEXT_PUBLIC_APP_URL"));
});
