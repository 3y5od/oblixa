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
  const raw = String(env.ENABLE_V5_EXTERNAL_COLLABORATION ?? "").trim().toLowerCase();
  if (!raw) return true;
  return !["false", "0", "no", "off"].includes(raw);
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
