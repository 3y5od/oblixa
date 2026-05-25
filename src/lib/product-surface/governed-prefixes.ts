import { PRODUCT_FEATURE_REGISTRY } from "@/lib/product-surface/feature-registry";

/**
 * URL path prefixes treated as governed dashboard pages for V8 inventory (union of registry `routePrefixes`
 * plus `/dashboard`, which maps under contracts in `resolveFeatureMappingForPagePath`).
 */
export function governedPageRootPrefixes(): readonly string[] {
  const set = new Set<string>();
  for (const row of PRODUCT_FEATURE_REGISTRY) {
    for (const p of row.routePrefixes) {
      if (p.startsWith("/")) set.add(p);
    }
  }
  set.add("/dashboard");
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** @deprecated Use governedPageRootPrefixes. */
export const v8GovernedPageRootPrefixes = governedPageRootPrefixes;
