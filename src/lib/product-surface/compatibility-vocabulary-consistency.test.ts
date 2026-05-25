import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import {
  SEARCH_INDEX_CLASSES,
  displayLabelForFeature,
  featureFamilyForPath,
  type FeatureFamilyKey,
} from "@/lib/product-surface/feature-registry";
import {
  isNavItemVisibleForSurface,
  type NavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";

/** Search index rows under the work umbrella use queue names, not the umbrella label "Work". */
const WORK_SEARCH_INDEX_LABELS: Partial<Record<(typeof SEARCH_INDEX_CLASSES)[number]["key"], string>> =
  {
    tasks: "Tasks",
    obligations: "Obligations",
    approvals: "Approvals",
  };

const CORE_ADMIN_SURFACE: NavSurfaceInput = {
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

/** §7.1 / §8.1 — Core admin, order-independent primary nav names.
 *  Programs/Advanced/Assurance and Tools remain hidden by mode. */
const CORE_ADMIN_PRIMARY_NAV_NAMES_SORTED = [
  "Contracts",
  "Dashboard",
  "Evidence",
  "Renewals",
  "Reports",
  "Settings",
  "Work",
].sort();

describe("V7 vocabulary consistency (§22.1 search index vs registry labels)", () => {
  it("keeps SEARCH_INDEX_CLASSES labels aligned where the index key matches its feature family", () => {
    for (const row of SEARCH_INDEX_CLASSES) {
      if (row.key !== row.featureFamily) continue;
      const expected = displayLabelForFeature(row.featureFamily as FeatureFamilyKey);
      expect(row.label, row.key).toBe(expected);
    }
  });

  it("freezes work-umbrella search index labels (key !== featureFamily work)", () => {
    for (const row of SEARCH_INDEX_CLASSES) {
      if (row.featureFamily !== "work") continue;
      const frozen = WORK_SEARCH_INDEX_LABELS[row.key];
      if (frozen !== undefined) {
        expect(row.label, row.key).toBe(frozen);
      }
    }
  });

  it("does not mark globalSearch rows as domain-only (cmd-K must list them)", () => {
    for (const row of SEARCH_INDEX_CLASSES) {
      if (row.globalSearch) {
        expect(row.domainOnlySearch, row.key).toBe(false);
      }
    }
  });

  it("keeps Core admin primary nav to the exact §7.1 set (order-independent)", () => {
    const visible = NAV_ITEMS.filter(
      (item) => item.section === "primary" && isNavItemVisibleForSurface(item, CORE_ADMIN_SURFACE)
    )
      .map((item) => item.name)
      .sort();
    expect(visible).toEqual(CORE_ADMIN_PRIMARY_NAV_NAMES_SORTED);
  });

  it("promotes Evidence to top-level and removes Report packs (v11 spec)", () => {
    // v11 dashboard spec compliance:
    // - Evidence promoted to top-level primary nav per spec §In-App Pages.
    // - Report packs removed entirely from nav per spec §Reports Page
    //   (not in the 10 Core reports list). Route still exists.
    const visiblePrimary = NAV_ITEMS.filter(
      (item) => item.section === "primary" && isNavItemVisibleForSurface(item, CORE_ADMIN_SURFACE)
    ).map((item) => item.name);
    expect(visiblePrimary).toContain("Evidence");
    expect(visiblePrimary).not.toContain("Report packs");
  });

  it("keeps Work tabs out of public Core navChildren", () => {
    const work = NAV_ITEMS.find((i) => i.name === "Work");
    expect(work?.navChildren ?? []).toEqual([]);
    expect(featureFamilyForPath("/work")).toBe("work");
  });
});
