import { getFeatureFlags } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  isHrefEligibleForProductSurface,
  productSurfaceContextFromNavSurface,
} from "@/lib/product-surface/href-eligibility";

/** Server convenience: flags from env (same as API guard). */
export function isHrefEligibleForNavSurfaceWithEnvFlags(surface: NavSurfaceInput, href: string): boolean {
  const ctx = productSurfaceContextFromNavSurface(surface);
  const withFlags = { ...ctx, featureFlags: getFeatureFlags() };
  return isHrefEligibleForProductSurface(withFlags, href);
}
