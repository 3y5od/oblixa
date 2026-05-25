/** Pure check for risky debug flags in production (used by `instrumentation.ts` + tests). */
export function hasProductionDebugMisconfiguration(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV !== "production") return false;
  const nodeOpts = env.NODE_OPTIONS ?? "";
  return Boolean(
    env.DEBUG ||
      env.NODE_DEBUG ||
      nodeOpts.includes("--inspect-brk") ||
      nodeOpts.includes("--inspect")
  );
}

/** Mirrors `parseFlag` in feature-flags: unset = enabled for external collaboration env gate. */
function externalCollaborationEnabledInEnv(env: NodeJS.ProcessEnv): boolean {
  const raw = String(env.ENABLE_EXTERNAL_COLLABORATION ?? env.ENABLE_V5_EXTERNAL_COLLABORATION ?? "").trim().toLowerCase();
  if (!raw) return true;
  return !["false", "0", "no", "off"].includes(raw);
}

export function listRuntimeCriticalProviderWarnings(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const warnings: string[] = [];
  const canonicalUrl = String(env.NEXT_PUBLIC_APP_URL ?? env.APP_BASE_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
  if (!canonicalUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(canonicalUrl)) {
    warnings.push("CANONICAL_APP_URL");
  }
  if (!String(env.RESEND_API_KEY ?? "").trim()) {
    warnings.push("RESEND_API_KEY");
  }
  if (!String(env.EMAIL_FROM ?? "").trim()) {
    warnings.push("EMAIL_FROM");
  }
  return warnings;
}

/**
 * When OBLIXA_STRICT_ENV=1 in production, returns env var names that should be set
 * for automation (cron, Stripe webhooks) but are missing. Empty outside that mode.
 */
export function listStrictProductionSecretDeficits(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (env.NODE_ENV !== "production") return [];
  if (env.OBLIXA_STRICT_ENV !== "1") return [];
  const missing: string[] = [];
  if (!String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!String(env.CRON_SECRET ?? "").trim()) {
    missing.push("CRON_SECRET");
  }
  if (!String(env.OBLIXA_STEP_UP_SECRET ?? "").trim()) {
    missing.push("OBLIXA_STEP_UP_SECRET");
  }
  if (String(env.STRIPE_SECRET_KEY ?? "").trim() && !String(env.STRIPE_WEBHOOK_SECRET ?? "").trim()) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }
  const upstashUrl = String(env.UPSTASH_REDIS_REST_URL ?? "").trim();
  const upstashTok = String(env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  if ((upstashUrl && !upstashTok) || (!upstashUrl && upstashTok)) {
    missing.push("UPSTASH_REDIS_REST_URL_AND_TOKEN_PAIR");
  }
  if (externalCollaborationEnabledInEnv(env)) {
    if (!String(env.EXTERNAL_ACTION_PASSCODE_PEPPER ?? "").trim()) {
      missing.push("EXTERNAL_ACTION_PASSCODE_PEPPER");
    }
    if (!String(env.EXTERNAL_ACTION_SUBMIT_TICKET_SECRET ?? "").trim()) {
      missing.push("EXTERNAL_ACTION_SUBMIT_TICKET_SECRET");
    }
  }
  return missing;
}

/** Soft recommendation: Vercel prod without Upstash may have weaker distributed rate limits. */
export function shouldRecommendUpstashOnVercel(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return false;
  if (env.VERCEL !== "1") return false;
  return !String(env.UPSTASH_REDIS_REST_URL ?? "").trim() && !String(env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
}

/** Keys that should never appear in NEXT_PUBLIC_* client bundles (false positives possible). */
export function listSuspiciousNextPublicKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith("NEXT_PUBLIC_")) continue;
    const val = String(v ?? "");
    if (/secret|password|private_key|service_role|api_key/i.test(k)) {
      bad.push(k);
    }
    if (/BEGIN [A-Z ]*PRIVATE KEY/.test(val)) {
      bad.push(`${k}(value)`);
    }
  }
  return bad;
}

const SECURITY_SECRET_KEYS = [
  "CRON_SECRET",
  "EXTERNAL_ACTION_PASSCODE_PEPPER",
  "EXTERNAL_ACTION_SUBMIT_TICKET_SECRET",
  "EXTRACTION_WORKER_SECRET",
  "OBLIXA_INTERNAL_DIAG_SECRET",
  "OBLIXA_STEP_UP_SECRET",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

function isProductionLikeSecretEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" || env.VERCEL === "1" || env.OBLIXA_STRICT_ENV === "1";
}

function isWeakSecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length < 32) return true;
  if (/^(test|secret|password|changeme|change-me|example|local|dev|good|bad|tok|token|x|c)$/i.test(trimmed)) return true;
  return /^([a-z0-9])\1{15,}$/i.test(trimmed);
}

export function listWeakProductionSecretFindings(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProductionLikeSecretEnv(env)) return [];
  const weak: string[] = [];
  for (const key of SECURITY_SECRET_KEYS) {
    const value = String(env[key] ?? "");
    if (isWeakSecretValue(value)) weak.push(key);
  }
  return weak;
}
