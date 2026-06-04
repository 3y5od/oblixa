import {
  hasProductionDebugMisconfiguration,
  listStrictProductionSecretDeficits,
  listRuntimeCriticalProviderWarnings,
  listSuspiciousNextPublicKeys,
  shouldRecommendUpstashOnVercel,
} from "@/lib/observability/instrumentation-env-warn";

/** Server/edge hooks only; avoid adding raw hrefs or org identifiers here — rely on Sentry configs + `sentry-scrub`. */

function isSentryRuntimeEnabled() {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.CI) ||
    process.env.OBLIXA_ENABLE_SENTRY_DEV === "1"
  );
}

function warnIfProductionDebugEnabled() {
  if (!hasProductionDebugMisconfiguration()) return;
  console.warn(
    "[instrumentation] production misconfiguration: debug/inspect-related env detected (details redacted)"
  );
}

function warnIfStrictEnvSecretsMissing() {
  const deficits = listStrictProductionSecretDeficits();
  if (deficits.length === 0) return;
  console.warn(
    `[instrumentation] OBLIXA_STRICT_ENV=1 but missing required secret(s): ${deficits.join(", ")}`
  );
}

function warnIfRuntimeProvidersMissing() {
  const deficits = listRuntimeCriticalProviderWarnings();
  if (deficits.length === 0) return;
  console.warn(`[instrumentation] runtime-critical provider prerequisites missing: ${deficits.join(", ")}`);
}

function warnIfSuspiciousNextPublic() {
  if (process.env.NODE_ENV !== "production") return;
  const hits = listSuspiciousNextPublicKeys();
  if (hits.length === 0) return;
  console.warn(
    `[instrumentation] suspicious NEXT_PUBLIC_* keys or values detected (review): ${hits.join(", ")}`
  );
}

function warnIfUpstashRecommended() {
  if (!shouldRecommendUpstashOnVercel()) return;
  console.warn(
    "[instrumentation] UPSTASH_REDIS_REST_URL/TOKEN not set on Vercel production — distributed rate limits fall back to in-memory per instance"
  );
}

export async function register() {
  warnIfProductionDebugEnabled();
  warnIfStrictEnvSecretsMissing();
  warnIfRuntimeProvidersMissing();
  warnIfSuspiciousNextPublic();
  warnIfUpstashRecommended();
  if (!isSentryRuntimeEnabled()) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    const { registerDebuggingSweepRuntime } = await import("@/lib/debugging-sweep/register-runtime");
    registerDebuggingSweepRuntime();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: typeof import("@sentry/nextjs").captureRequestError = async (...args) => {
  if (!isSentryRuntimeEnabled()) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
};
