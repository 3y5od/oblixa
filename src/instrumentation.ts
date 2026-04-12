import * as Sentry from "@sentry/nextjs";
import { hasProductionDebugMisconfiguration } from "@/lib/observability/instrumentation-env-warn";

/** Server/edge hooks only; avoid adding raw hrefs or org identifiers here — rely on Sentry configs + `sentry-scrub`. */

function warnIfProductionDebugEnabled() {
  if (!hasProductionDebugMisconfiguration()) return;
  console.warn(
    "[instrumentation] production misconfiguration: debug/inspect-related env detected (details redacted)"
  );
}

export async function register() {
  warnIfProductionDebugEnabled();
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

