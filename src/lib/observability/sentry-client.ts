import * as Sentry from "@sentry/nextjs";

const HAS_CLIENT_DSN = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());

export function captureClientException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (!HAS_CLIENT_DSN) return;
  Sentry.captureException(error, context);
}

/** Scrubbed product-surface denial breadcrumbs for client-reachable diagnostics. */
export function addProductSurfaceDiagnosticBreadcrumb(
  channel: string,
  details: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS !== "1") return;
  if (!HAS_CLIENT_DSN) return;
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
