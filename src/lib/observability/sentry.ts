import * as Sentry from "@sentry/nextjs";

const HAS_SERVER_DSN = Boolean(process.env.SENTRY_DSN?.trim());
const HAS_CLIENT_DSN = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());

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

export function captureClientException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (!HAS_CLIENT_DSN) return;
  Sentry.captureException(error, context);
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
