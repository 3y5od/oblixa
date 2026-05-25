import { buildProductSurfaceContext, type ProductSurfaceContext } from "@/lib/product-surface/context-core";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { featureFamilyForPath } from "@/lib/product-surface/feature-registry";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";
import { resolveFeatureMappingForPagePath } from "@/lib/product-surface/surface-mapping";
import { governedPageRootPrefixes } from "@/lib/product-surface/governed-prefixes";

/** Governed roots fail closed when mapping is unresolved (single source: `v8-governed-prefixes`). */
const GOVERNED_ROOT_PREFIXES = governedPageRootPrefixes();

function pathnameFromHref(href: string): string {
  const raw = href.split("?")[0] ?? href;
  return raw.split("#")[0] ?? raw;
}

export function featureFamilyForHref(href: string): ReturnType<typeof featureFamilyForPath> {
  return featureFamilyForPath(pathnameFromHref(href));
}

function matchesGovernedRootPrefix(pathname: string): boolean {
  for (const p of GOVERNED_ROOT_PREFIXES) {
    if (p === "/") return pathname === "/";
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

export function isHrefEligibleForProductSurface(ctx: ProductSurfaceContext, href: string): boolean {
  const pathname = pathnameFromHref(href);
  const mapping = resolveFeatureMappingForPagePath(pathname);
  if (mapping.status === "exempt") return true;
  if (mapping.status === "unmapped") {
    if (matchesGovernedRootPrefix(pathname)) {
      logProductSurfaceDiagnostic("href_eligibility_denied", {
        href,
        pathname,
        reason: "registry_missing_or_mapping_missing",
      });
      return false;
    }
    return true;
  }
  const family = featureFamilyForPath(pathname) ?? mapping.featureFamily;
  const eligibility = evaluateFeatureEligibility(ctx, family, {
    surfaceType: "page",
    surfaceIdentifier: pathname,
  });
  if (!eligibility.allowed) {
    logProductSurfaceDiagnostic("href_eligibility_denied", {
      href,
      pathname,
      family,
      reason: eligibility.reason,
      denialClass: eligibility.denialClass,
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
