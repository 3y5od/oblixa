import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { NAV_ITEMS } from "@/lib/navigation";
import { CMDK_EXTRA_NAV_ITEMS, isCmdkHrefAllowed } from "@/lib/product-surface/resolver";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  REPORT_HASH_MAP,
  featureFamilyForPath,
  minWorkspaceModeForReportsHash,
} from "@/lib/product-surface/feature-registry";
import { minWorkspaceModeForPath } from "@/lib/product-surface/routes";

function normalizedPath(href: string): string {
  return href.split("?")[0] ?? href;
}

describe("feature registry drift checks", () => {
  it("advanced/assurance nav hrefs resolve to a registry family", () => {
    const hrefs = NAV_ITEMS.map((i) => normalizedPath(i.href)).filter(
      (href) =>
        href.startsWith("/decisions") ||
        href.startsWith("/campaigns") ||
        href.startsWith("/assurance") ||
        href.startsWith("/contracts/programs") ||
        href.startsWith("/relationship-workspaces")
    );
    for (const href of hrefs) {
      expect(featureFamilyForPath(href), href).not.toBeNull();
    }
  });

  it("cmd-k extra hrefs resolve to a registry family", () => {
    for (const item of CMDK_EXTRA_NAV_ITEMS) {
      const path = normalizedPath(item.href);
      expect(featureFamilyForPath(path), path).not.toBeNull();
    }
  });

  it("cmd-k extra deep links are allowed on Advanced surfaces when flags permit (§Z)", () => {
    const flags = Object.fromEntries(
      (
        [
          "v5PortfolioCampaigns",
          "v5ControlRoomUx",
        ] as const satisfies readonly FeatureFlagKey[]
      ).map((k) => [k, true])
    ) as Record<FeatureFlagKey, boolean>;
    const surface: NavSurfaceInput = {
      mode: "advanced",
      role: "admin",
      featureFlags: flags,
      seesAdvancedPrimaryNav: true,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    for (const item of CMDK_EXTRA_NAV_ITEMS) {
      expect(isCmdkHrefAllowed(item.href, surface), item.href).toBe(true);
    }
  });

  it("advanced cmd-k extra deep links are blocked on Core surfaces", () => {
    const surface: NavSurfaceInput = {
      mode: "core",
      role: "admin",
      featureFlags: {} as NavSurfaceInput["featureFlags"],
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    for (const item of CMDK_EXTRA_NAV_ITEMS.filter(
      (item) => minWorkspaceModeForPath(normalizedPath(item.href)) !== "core"
    )) {
      expect(isCmdkHrefAllowed(item.href, surface), item.href).toBe(false);
    }
  });

  it("reports nav hash links align with REPORT_HASH_MAP", () => {
    const reports = NAV_ITEMS.find((i) => i.href === "/reports");
    const hashes =
      reports?.navChildren
        ?.map((c) => (c.href.includes("#") ? (c.href.split("#")[1] ?? "").toLowerCase() : ""))
        .filter(Boolean) ?? [];
    const mapped = new Set(REPORT_HASH_MAP.map((row) => row.hash));
    for (const hash of hashes) {
      expect(mapped.has(hash), hash).toBe(true);
      expect(minWorkspaceModeForReportsHash(hash)).not.toBe("core");
    }
  });
});
