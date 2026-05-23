#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

export const RELEASE_STRICT_ENV_KEYS = ["OBLIXA_RELEASE_SECURITY_STRICT", "SECURITY_RELEASE_STRICT"];
export const DATABASE_URL_GROUP = ["RLS_SMOKE_DATABASE_URL", "SUPABASE_DB_URL", "DATABASE_URL"];
export const DAST_STAGING_URL_GROUP = ["STAGING_BASE_URL"];
export const DAST_LOCAL_URL_GROUP = ["DAST_LOCAL_BASE_URL", "PLAYWRIGHT_BASE_URL"];
export const AUTHENTICATED_E2E_KEYS = ["E2E_TEST_EMAIL", "E2E_TEST_PASSWORD"];
export const DISTRIBUTED_LIMITER_KEYS = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
export const SECURITY_RUNTIME_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CRON_SECRET",
  "OBLIXA_INTERNAL_HMAC_SECRET",
  "OBLIXA_STEP_UP_SECRET",
];

export const PREVIOUS_SECRET_EXPIRY_PAIRS = [
  ["CRON_SECRET_PREVIOUS", "CRON_SECRET_PREVIOUS_EXPIRES_AT"],
  ["OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET", "OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT"],
  ["INBOUND_AUTOMATION_TOKEN_PREVIOUS", "INBOUND_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT"],
  ["INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS", "INBOUND_EMAIL_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT"],
  ["INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS", "INBOUND_SLACK_AUTOMATION_TOKEN_PREVIOUS_EXPIRES_AT"],
  ["INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS", "INBOUND_INTEGRATIONS_CALLBACK_TOKEN_PREVIOUS_EXPIRES_AT"],
];

function isSet(env, key) {
  return Boolean(env[key]?.trim());
}

function isStrictReleaseEnv(env) {
  return RELEASE_STRICT_ENV_KEYS.some((key) => env[key] === "1" || env[key] === "true");
}

function groupSatisfied(env, keys) {
  return keys.some((key) => isSet(env, key));
}

function requireKeys(env, issues, keys, reason) {
  for (const key of keys) {
    if (!isSet(env, key)) issues.push({ issue: "missing_required_env", key, reason });
  }
}

function requireGroup(env, issues, keys, reason) {
  if (!groupSatisfied(env, keys)) issues.push({ issue: "missing_required_env_group", keys, reason });
}

function validateFutureIso(value, nowMs) {
  if (!value?.trim()) return "missing";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "invalid_iso_datetime";
  if (ms <= nowMs) return "expired";
  return "ok";
}

function validatePreviousSecretExpiries(env, issues, strict, nowMs) {
  for (const [secretKey, expiresKey] of PREVIOUS_SECRET_EXPIRY_PAIRS) {
    if (!isSet(env, secretKey)) continue;
    const status = validateFutureIso(env[expiresKey], nowMs);
    if (status === "ok") continue;
    if (strict || status !== "missing") {
      issues.push({
        issue: "invalid_previous_secret_expiry",
        secretKey,
        expiresKey,
        reason: status,
      });
    }
  }
}

function validateDastTarget(env, issues, strict) {
  if (groupSatisfied(env, DAST_STAGING_URL_GROUP)) return;
  if (env.DAST_TARGET_MODE === "local" && groupSatisfied(env, DAST_LOCAL_URL_GROUP)) return;
  if (strict) {
    issues.push({
      issue: "missing_dast_target",
      reason: "strict_release_requires_staging_url_or_explicit_local_dast_target",
      stagingUrlKeys: DAST_STAGING_URL_GROUP,
      localModeKey: "DAST_TARGET_MODE=local",
      localUrlKeys: DAST_LOCAL_URL_GROUP,
    });
  }
}

function validateZapBaseline(root, issues, strict) {
  const rel = "artifacts/zap-baseline.json";
  const abs = path.join(root, rel);
  if (fs.existsSync(abs)) return;
  if (strict) issues.push({ issue: "missing_zap_baseline_artifact", rel });
}

export function analyzeReleaseSecurityRequiredEnv(options = {}) {
  const env = options.env ?? process.env;
  const root = options.root ?? ROOT;
  const nowMs = options.nowMs ?? Date.now();
  const strict = options.strict ?? isStrictReleaseEnv(env);
  const issues = [];

  validatePreviousSecretExpiries(env, issues, strict, nowMs);

  if (strict) {
    requireGroup(env, issues, DATABASE_URL_GROUP, "strict_release_requires_live_rls_smoke_database_url");
    validateDastTarget(env, issues, strict);
    requireKeys(env, issues, AUTHENTICATED_E2E_KEYS, "strict_release_requires_authenticated_e2e_credentials");
    requireKeys(env, issues, DISTRIBUTED_LIMITER_KEYS, "strict_release_requires_distributed_rate_limiter");
    requireKeys(env, issues, SECURITY_RUNTIME_KEYS, "strict_release_requires_security_runtime_configuration");
    validateZapBaseline(root, issues, strict);
  }

  return {
    checkId: "release-security-required-env",
    ok: issues.length === 0,
    mode: strict ? "strict_release" : "advisory",
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeReleaseSecurityRequiredEnv();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
