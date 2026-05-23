import assert from "node:assert/strict";
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

function strictEnv(overrides = {}) {
  return {
    OBLIXA_RELEASE_SECURITY_STRICT: "1",
    RLS_SMOKE_DATABASE_URL: "postgres://user:pass@example.test/db",
    STAGING_BASE_URL: "https://staging.example.test",
    E2E_TEST_EMAIL: "security@example.test",
    E2E_TEST_PASSWORD: "test-password",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    CRON_SECRET: "cron-secret",
    OBLIXA_INTERNAL_HMAC_SECRET: "hmac-secret",
    OBLIXA_STEP_UP_SECRET: "step-up-secret",
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
