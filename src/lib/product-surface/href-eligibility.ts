import { buildProductSurfaceContext, type ProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { featureFamilyForPath } from "@/lib/product-surface/feature-registry";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { getFeatureFlags } from "@/lib/feature-flags";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";

/** Path prefixes that must not be reachable without a resolved feature family when gating links. */
const STRICT_DENY_PREFIXES = [
  "/decisions",
  "/decisions/compare",
  "/campaigns",
  "/campaigns/compare",
  "/assurance",
  "/relationship-workspaces",
  "/accounts",
  "/counterparties",
  "/contracts/programs",
  "/contracts/maintenance",
  "/contracts/collaboration",
] as const;

function pathnameFromHref(href: string): string {
  const raw = href.split("?")[0] ?? href;
  return raw.split("#")[0] ?? raw;
}

export function featureFamilyForHref(href: string): ReturnType<typeof featureFamilyForPath> {
  return featureFamilyForPath(pathnameFromHref(href));
}

function matchesStrictDenyPrefix(pathname: string): boolean {
  for (const p of STRICT_DENY_PREFIXES) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

export function isHrefEligibleForProductSurface(ctx: ProductSurfaceContext, href: string): boolean {
  const pathname = pathnameFromHref(href);
  const family = featureFamilyForPath(pathname);
  if (!family) {
    if (matchesStrictDenyPrefix(pathname)) {
      logProductSurfaceDiagnostic("href_eligibility_denied", {
        href,
        pathname,
        reason: "strict_unmapped_prefix",
      });
      return false;
    }
    return true;
  }
  const eligibility = evaluateFeatureEligibility(ctx, family);
  if (!eligibility.allowed) {
    logProductSurfaceDiagnostic("href_eligibility_denied", {
      href,
      pathname,
      family,
      reason: eligibility.reason,
      discoverability: eligibility.discoverability,
    });
  }
  return eligibility.allowed;
}

/**
 * Client-safe surface check: rebuilds org context from serialized nav input.
 * `seesAdvancedPrimaryNav` / `seesAssuranceNav` override computed defaults so cmd-K matches server nav.
 */
export function productSurfaceContextFromNavSurface(
  surface: NavSurfaceInput,
  orgId: string = "__nav_surface__"
): ProductSurfaceContext {
  const v6 = {
    workspace_mode: surface.mode,
    advanced_modules_hidden: [...surface.advancedModulesHidden],
    assurance_modules_hidden: [...surface.assuranceModulesHidden],
    utility_modules_hidden: [...surface.utilityModulesHidden],
    search_scope: surface.searchScope,
  };
  const base = buildProductSurfaceContext({
    orgId,
    role: surface.role,
    v6,
    featureFlags: surface.featureFlags,
  });
  return {
    ...base,
    seesAdvancedPrimaryNav: surface.seesAdvancedPrimaryNav,
    seesAssuranceNav: surface.seesAssuranceNav,
  };
}

export function isHrefEligibleForNavSurface(surface: NavSurfaceInput, href: string): boolean {
  const ctx = productSurfaceContextFromNavSurface(surface);
  return isHrefEligibleForProductSurface(ctx, href);
}

/** Server convenience: flags from env (same as API guard). */
export function isHrefEligibleForNavSurfaceWithEnvFlags(surface: NavSurfaceInput, href: string): boolean {
  const ctx = productSurfaceContextFromNavSurface(surface);
  const withFlags = { ...ctx, featureFlags: getFeatureFlags() };
  return isHrefEligibleForProductSurface(withFlags, href);
}
