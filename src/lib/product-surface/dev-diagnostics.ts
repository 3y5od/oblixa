export type ProductSurfaceDiagnosticChannel =
  | "nav_badges"
  | "cmdk_recent_hrefs"
  | "api_workspace_gate_denied"
  | "cmdk_search_index_filtered"
  | "href_eligibility_denied"
  | "nav_badge_payload_filtered";

import { addProductSurfaceDiagnosticBreadcrumb } from "@/lib/observability/sentry";

/**
 * Optional dev-time warning hook for product-surface leakage diagnostics (§21.2).
 * Enable with PRODUCT_SURFACE_DIAGNOSTICS=1 outside production.
 * Production breadcrumbs: PRODUCT_SURFACE_SENTRY_DIAGNOSTICS=1 (scrubbed keys only).
 */
export function logProductSurfaceDiagnostic(
  channel: ProductSurfaceDiagnosticChannel,
  details: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "production" && process.env.PRODUCT_SURFACE_DIAGNOSTICS === "1") {
    console.warn(`[product-surface:diagnostic] ${channel}`, details);
  }
  addProductSurfaceDiagnosticBreadcrumb(channel, details);
}
