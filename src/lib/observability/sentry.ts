import * as Sentry from "@sentry/nextjs";

/** Max tags per sweep correlation attach (Sentry limits tags; stay conservative). */
export const SENTRY_SWEEP_MAX_TAGS = 50;

const HAS_SERVER_DSN = Boolean(process.env.SENTRY_DSN?.trim());

export function captureServerException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (!HAS_SERVER_DSN) return;
  Sentry.captureException(error, context);
}

export function captureServerMessage(
  message: string,
  context?: Parameters<typeof Sentry.captureMessage>[1]
): void {
  if (!HAS_SERVER_DSN) return;
  Sentry.captureMessage(message, context);
}

export function truncateSweepTag(value: string, max = 200): string {
  const t = value.replace(/[\r\n]/g, "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Optional correlation context for sweep / internal diagnostics (no secrets). */
export function setSweepCorrelationContext(data: Record<string, string>): void {
  if (!HAS_SERVER_DSN) return;
  const entries = Object.entries(data).slice(0, SENTRY_SWEEP_MAX_TAGS);
  Sentry.setContext(
    "sweep_correlation",
    Object.fromEntries(entries.map(([k, v]) => [k, truncateSweepTag(v, 200)]))
  );
}

/** Scrubbed product-surface denial breadcrumbs (V7 §21.2); enable with PRODUCT_SURFACE_SENTRY_DIAGNOSTICS=1. */
export function addProductSurfaceDiagnosticBreadcrumb(
  channel: string,
  details: Record<string, unknown>
): void {
  if (process.env.PRODUCT_SURFACE_SENTRY_DIAGNOSTICS !== "1") return;
  const family = details.family;
  const reason = details.reason;
  const discoverability = details.discoverability;
  Sentry.addBreadcrumb({
    category: "product_surface",
    message: channel,
    level: "info",
    data: {
      ...(typeof family === "string" ? { family } : {}),
      ...(typeof reason === "string" ? { reason } : {}),
      ...(typeof discoverability === "string" ? { discoverability } : {}),
    },
  });
}
