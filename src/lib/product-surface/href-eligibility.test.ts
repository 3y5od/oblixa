import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import {
  isHrefEligibleForNavSurface,
  isHrefEligibleForProductSurface,
  productSurfaceContextFromNavSurface,
} from "@/lib/product-surface/href-eligibility";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

describe("href eligibility", () => {
  it("denies advanced hrefs for core mode", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "editor",
      v6: { workspace_mode: "core" },
      featureFlags: noFlags,
    });
    expect(isHrefEligibleForProductSurface(ctx, "/decisions")).toBe(false);
  });

  it("allows dashboard for core", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "editor",
      v6: { workspace_mode: "core" },
      featureFlags: noFlags,
    });
    expect(isHrefEligibleForProductSurface(ctx, "/dashboard")).toBe(true);
  });

  it("denies strict hidden-family prefixes even when unmapped", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "viewer",
      v6: { workspace_mode: "core" },
      featureFlags: noFlags,
    });
    expect(isHrefEligibleForProductSurface(ctx, "/relationship-workspaces/private")).toBe(false);
  });

  it("supports nav-surface wrapper checks", () => {
    const surface: NavSurfaceInput = {
      mode: "core",
      role: "viewer",
      featureFlags: noFlags,
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    expect(isHrefEligibleForNavSurface(surface, "/decisions")).toBe(false);
    expect(isHrefEligibleForNavSurface(surface, "/contracts")).toBe(true);
  });

  it("rebuilds context from nav-surface flags", () => {
    const surface: NavSurfaceInput = {
      mode: "advanced",
      role: "manager",
      featureFlags: noFlags,
      seesAdvancedPrimaryNav: true,
      seesAssuranceNav: false,
      advancedModulesHidden: ["decisions"],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    const ctx = productSurfaceContextFromNavSurface(surface);
    expect(ctx.seesAdvancedPrimaryNav).toBe(true);
    expect(isHrefEligibleForProductSurface(ctx, "/decisions")).toBe(false);
  });
});
