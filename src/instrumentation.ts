import * as Sentry from "@sentry/nextjs";
import {
  hasProductionDebugMisconfiguration,
  listStrictProductionSecretDeficits,
  listRuntimeCriticalProviderWarnings,
  listSuspiciousNextPublicKeys,
  shouldRecommendUpstashOnVercel,
} from "@/lib/observability/instrumentation-env-warn";

/** Server/edge hooks only; avoid adding raw hrefs or org identifiers here — rely on Sentry configs + `sentry-scrub`. */

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
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    const { registerDebuggingSweepRuntime } = await import("@/lib/debugging-sweep/register-runtime");
    registerDebuggingSweepRuntime();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

