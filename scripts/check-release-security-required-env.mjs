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
export const PROVIDER_RELEASE_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
];

export const PREVIOUS_SECRET_EXPIRY_PAIRS = [
  ["CRON_SECRET_PREVIOUS", "CRON_SECRET_PREVIOUS_EXPIRES_AT"],
  ["OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET", "OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT"],
  ["STRIPE_WEBHOOK_SECRET_PREVIOUS", "STRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT"],
  ["EXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS", "EXTERNAL_ACTION_SUBMIT_TICKET_SECRET_PREVIOUS_EXPIRES_AT"],
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

function isLocalOrPrivateHostname(hostname) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")) return true;
  if (lower === "::1" || lower === "[::1]") return true;
  if (/^127\./u.test(lower) || lower === "0.0.0.0") return true;
  if (/^10\./u.test(lower)) return true;
  if (/^192\.168\./u.test(lower)) return true;
  const private172 = /^172\.(\d{1,2})\./u.exec(lower);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function validateUrlEnv(env, issues, key, options = {}) {
  const value = env[key]?.trim();
  if (!value) return;
  const url = parseUrl(value);
  if (!url) {
    issues.push({ issue: "malformed_url_env", key });
    return;
  }

  const allowedProtocols = options.allowedProtocols ?? ["https:"];
  if (!allowedProtocols.includes(url.protocol)) {
    issues.push({ issue: "invalid_url_protocol", key, protocol: url.protocol, allowedProtocols });
  }

  if (!options.allowLocal && isLocalOrPrivateHostname(url.hostname)) {
    issues.push({ issue: "local_or_private_url_not_allowed_for_release", key, hostname: url.hostname });
  }
}

function validatePrefixEnv(env, issues, key, prefixes) {
  const value = env[key]?.trim();
  if (!value) return;
  if (!prefixes.some((prefix) => value.startsWith(prefix))) {
    issues.push({ issue: "invalid_key_prefix", key, expectedPrefixes: prefixes });
  }
}

function looksPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (/(?:placeholder|changeme|change-me|example|dummy|fake|todo)/u.test(normalized)) return true;
  if (/^(?:secret|token|password|test|dev|local|sample)[-_a-z0-9]*$/u.test(normalized)) return true;
  return /^([a-z0-9])\1{11,}$/u.test(normalized);
}

function validateSecretQuality(env, issues, key, options = {}) {
  const value = env[key]?.trim();
  if (!value) return;
  const minLength = options.minLength ?? 32;
  if (value.length < minLength || looksPlaceholder(value)) {
    issues.push({ issue: "weak_release_secret_value", key, minLength });
  }
}

function validateTokenEncryptionKey(env, issues) {
  const key = env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (!key) return;
  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== 32 || decoded.toString("base64").replace(/=+$/u, "") !== key.replace(/=+$/u, "")) {
    issues.push({ issue: "invalid_integration_token_encryption_key", key: "INTEGRATION_TOKEN_ENCRYPTION_KEY", reason: "must_be_base64_32_bytes" });
  }

  const activeKeyId = env.OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID?.trim() || "default";
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(activeKeyId)) {
    issues.push({ issue: "invalid_token_encryption_key_id", key: "OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID" });
  }
  if (activeKeyId !== "default") {
    const activeEnvKey = `OBLIXA_TOKEN_ENCRYPTION_KEY_${activeKeyId.toUpperCase().replace(/[^A-Z0-9]/gu, "_")}`;
    if (!env[activeEnvKey]?.trim()) {
      issues.push({ issue: "missing_active_token_encryption_key", key: activeEnvKey, activeKeyId });
    }
  }
}

function stripeMode(value) {
  if (!value) return null;
  if (/_(?:test)_/u.test(value) || value.startsWith("pk_test_") || value.startsWith("sk_test_")) return "test";
  if (/_(?:live)_/u.test(value) || value.startsWith("pk_live_") || value.startsWith("sk_live_")) return "live";
  return null;
}

function releaseEnvironment(env) {
  const explicit = env.OBLIXA_RELEASE_ENVIRONMENT?.trim().toLowerCase();
  if (["local", "preview", "staging", "production"].includes(explicit)) return explicit;
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") return "production";
  if (env.VERCEL_ENV === "preview") return "preview";
  return "unknown";
}

function validateStripeMode(env, issues) {
  const publishableMode = stripeMode(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
  const secretMode = stripeMode(env.STRIPE_SECRET_KEY?.trim());
  if (publishableMode && secretMode && publishableMode !== secretMode) {
    issues.push({
      issue: "mixed_stripe_key_modes",
      publicKeyMode: publishableMode,
      secretKeyMode: secretMode,
    });
  }

  const environment = releaseEnvironment(env);
  const observedMode = secretMode ?? publishableMode;
  if (environment === "production" && observedMode === "test") {
    issues.push({ issue: "mixed_environment_credentials", provider: "stripe", environment, observedMode });
  }
  if ((environment === "preview" || environment === "staging") && observedMode === "live") {
    issues.push({ issue: "mixed_environment_credentials", provider: "stripe", environment, observedMode });
  }
}

function valueEnvironmentSignal(value) {
  const lower = String(value ?? "").toLowerCase();
  if (!lower) return null;
  const url = parseUrl(value);
  if (url && isLocalOrPrivateHostname(url.hostname)) return "local";
  if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b)/u.test(lower)) return "local";
  if (/(?:staging|stage|preview|sandbox|test)/u.test(lower)) return "staging";
  if (/(?:production|prod|live)/u.test(lower)) return "production";
  return null;
}

function validateEnvironmentMixing(env, issues) {
  const environment = releaseEnvironment(env);
  if (environment === "unknown") return;
  const keys = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "RLS_SMOKE_DATABASE_URL",
    "SUPABASE_DB_URL",
    "DATABASE_URL",
    "UPSTASH_REDIS_REST_URL",
    "SENTRY_DSN",
    "NEXT_PUBLIC_SENTRY_DSN",
  ];

  for (const key of keys) {
    const signal = valueEnvironmentSignal(env[key]);
    if (!signal) continue;
    if (environment === "production" && signal !== "production") {
      issues.push({ issue: "mixed_environment_credentials", key, environment, observedSignal: signal });
    }
    if ((environment === "preview" || environment === "staging") && signal === "production") {
      issues.push({ issue: "mixed_environment_credentials", key, environment, observedSignal: signal });
    }
  }
}

function validateProviderContracts(env, issues, strict) {
  validateUrlEnv(env, issues, "RLS_SMOKE_DATABASE_URL", { allowedProtocols: ["postgres:", "postgresql:"] });
  validateUrlEnv(env, issues, "SUPABASE_DB_URL", { allowedProtocols: ["postgres:", "postgresql:"] });
  validateUrlEnv(env, issues, "DATABASE_URL", { allowedProtocols: ["postgres:", "postgresql:"] });
  validateUrlEnv(env, issues, "STAGING_BASE_URL");
  validateUrlEnv(env, issues, "DAST_LOCAL_BASE_URL", { allowedProtocols: ["http:", "https:"], allowLocal: true });
  validateUrlEnv(env, issues, "PLAYWRIGHT_BASE_URL", { allowedProtocols: ["http:", "https:"], allowLocal: true });
  validateUrlEnv(env, issues, "NEXT_PUBLIC_APP_URL");
  validateUrlEnv(env, issues, "NEXT_PUBLIC_SUPABASE_URL");
  validateUrlEnv(env, issues, "UPSTASH_REDIS_REST_URL");
  validateUrlEnv(env, issues, "SENTRY_DSN");
  validateUrlEnv(env, issues, "NEXT_PUBLIC_SENTRY_DSN");

  validatePrefixEnv(env, issues, "NEXT_PUBLIC_SUPABASE_ANON_KEY", ["eyJ"]);
  validatePrefixEnv(env, issues, "SUPABASE_SERVICE_ROLE_KEY", ["eyJ"]);
  validatePrefixEnv(env, issues, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", ["pk_test_", "pk_live_"]);
  validatePrefixEnv(env, issues, "STRIPE_SECRET_KEY", ["sk_test_", "sk_live_"]);
  validatePrefixEnv(env, issues, "STRIPE_WEBHOOK_SECRET", ["whsec_"]);
  validatePrefixEnv(env, issues, "STRIPE_WEBHOOK_SECRET_PREVIOUS", ["whsec_"]);
  validatePrefixEnv(env, issues, "RESEND_API_KEY", ["re_"]);
  validatePrefixEnv(env, issues, "OPENAI_API_KEY", ["sk-"]);

  validateStripeMode(env, issues);
  validateEnvironmentMixing(env, issues);
  validateTokenEncryptionKey(env, issues);

  if (strict) {
    for (const key of [
      "CRON_SECRET",
      "OBLIXA_INTERNAL_HMAC_SECRET",
      "OBLIXA_STEP_UP_SECRET",
      "UPSTASH_REDIS_REST_TOKEN",
      "STRIPE_WEBHOOK_SECRET",
    ]) {
      validateSecretQuality(env, issues, key);
    }
  }
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
    requireKeys(env, issues, PROVIDER_RELEASE_KEYS, "strict_release_requires_provider_configuration");
    validateZapBaseline(root, issues, strict);
  }
  validateProviderContracts(env, issues, strict);

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
