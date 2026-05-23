export type ProductSurfaceDiagnosticChannel =
  | "nav_badges"
  | "cmdk_recent_hrefs"
  | "api_workspace_gate_denied"
  | "cmdk_search_index_filtered"
  | "href_eligibility_denied"
  | "nav_badge_payload_filtered"
  | "surface_mapping_missing"
  | "server_action_eligibility_denied"
  | "landing_path_normalized";

import { addProductSurfaceDiagnosticBreadcrumb } from "@/lib/observability/sentry-client";

/**
 * Optional dev-time warning hook for product-surface leakage diagnostics (§21.2).
 * Enable with NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS=1 outside production.
 * Production breadcrumbs: NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS=1 (scrubbed keys only).
 */
export function logProductSurfaceDiagnostic(
  channel: ProductSurfaceDiagnosticChannel,
  details: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS === "1") {
    console.warn(`[product-surface:diagnostic] ${channel}`, details);
  }
  addProductSurfaceDiagnosticBreadcrumb(channel, details);
}
