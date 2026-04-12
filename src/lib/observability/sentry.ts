import * as Sentry from "@sentry/nextjs";

function hasServerDsn(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function hasClientDsn(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}

export function captureServerException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (!hasServerDsn()) return;
  Sentry.captureException(error, context);
}

export function captureServerMessage(
  message: string,
  context?: Parameters<typeof Sentry.captureMessage>[1]
): void {
  if (!hasServerDsn()) return;
  Sentry.captureMessage(message, context);
}

export function captureClientException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (!hasClientDsn()) return;
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
