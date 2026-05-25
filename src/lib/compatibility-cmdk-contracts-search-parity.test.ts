import { describe, expect, it } from "vitest";
import {
  buildContractsListHref,
  buildContractsSearchListHref,
  normalizeContractsSearchQuery,
} from "@/lib/contracts-search-url";
import { getCmdkSearchJumpItems } from "@/lib/product-surface/cmdk-search-jumps";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

function coreSurface(): NavSurfaceInput {
  return {
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
}

describe("CmdK vs in-page contracts search URL parity (§9.3 + §16)", () => {
  it("matches buildContractsSearchListHref for every sample query", () => {
    for (const q of ["", "  ", "Acme & Co", "100% renewal", `café / bar`, `quoted "term"`]) {
      const expected = buildContractsSearchListHref(q);
      const items = getCmdkSearchJumpItems(coreSurface(), q.trim());
      const contractsJump = items.find((i) => i.id === "search-jump:contracts");
      expect(contractsJump?.href, q).toBe(expected);
    }
  });

  it("sanitizes the contracts list search query the same way for page and CmdK entry points", () => {
    const raw = `  100% renewal, "APAC"  `;
    expect(normalizeContractsSearchQuery(raw)).toBe("100 renewal APAC");
    expect(buildContractsSearchListHref(raw)).toBe(buildContractsListHref({ search: raw }));
    expect(
      buildContractsListHref({
        search: raw,
        status: "active",
        owner: "owner-1",
      })
    ).toBe(buildContractsListHref({ search: "100 renewal APAC", status: "active", owner: "owner-1" }));
  });
});
