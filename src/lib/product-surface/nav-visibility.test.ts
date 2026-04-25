import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { NAV_ITEMS } from "@/lib/navigation";
import {
  filterNavBadgesForSurface,
  isNavChildVisibleForSurface,
  isNavItemVisibleForSurface,
  type NavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import { moreToolsIndexHasVisibleEntries } from "@/lib/product-surface/more-index-visibility";

const ALL_FLAG_KEYS: FeatureFlagKey[] = [
  "v3TasksEngine",
  "v3ObligationsExecution",
  "v3ApprovalsSla",
  "v3RenewalWorkspace",
  "v3IntakePipeline",
  "v3PersonaDashboards",
  "v3ReportingHistory",
  "v3AutomationExpansion",
  "v5DecisionFoundation",
  "v5PortfolioCampaigns",
  "v5SimulationAndIntelligence",
  "v5RelationshipLayer",
  "v5ExternalCollaboration",
  "v5ControlRoomUx",
  "v6AssuranceCore",
  "v6ControlPolicies",
  "v6AdaptivePlaybooks",
  "v6Autopilot",
  "v6OutcomeIntelligence",
  "v6ReviewBoards",
  "v6Segments",
  "v6AutopilotAllowExecution",
];
const allFlagsOn = Object.fromEntries(ALL_FLAG_KEYS.map((k) => [k, true])) as Record<
  FeatureFlagKey,
  boolean
>;

function surface(mode: NavSurfaceInput["mode"]): NavSurfaceInput {
  return {
    mode,
    role: "admin",
    featureFlags: allFlagsOn,
    seesAdvancedPrimaryNav: mode !== "core",
    seesAssuranceNav: mode === "assurance",
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
  };
}

describe("moreToolsIndexHasVisibleEntries (Appendix B)", () => {
  it("is true for typical Core and Advanced surfaces (tools index is non-empty)", () => {
    expect(moreToolsIndexHasVisibleEntries(surface("core"), false)).toBe(true);
    expect(moreToolsIndexHasVisibleEntries(surface("advanced"), true)).toBe(true);
  });

  it("treats missing surface as show link (pre-auth / transitional layout)", () => {
    expect(moreToolsIndexHasVisibleEntries(null, false)).toBe(true);
  });

  it("does not depend on the /more self-link to consider the index non-empty", () => {
    const s = {
      ...surface("core"),
      utilityModulesHidden: ["more_tools"] as const,
    };
    expect(moreToolsIndexHasVisibleEntries(s, false)).toBe(true);
  });
});

describe("isNavChildVisibleForSurface — reports anchors", () => {
  it("hides advanced report hashes in core", () => {
    expect(
      isNavChildVisibleForSurface({ href: "/reports#campaign-drift" }, surface("core"))
    ).toBe(false);
    expect(
      isNavChildVisibleForSurface({ href: "/reports#portfolio-analytics" }, surface("core"))
    ).toBe(false);
  });

  it("shows standard report children in core", () => {
    expect(isNavChildVisibleForSurface({ href: "/reports" }, surface("core"))).toBe(true);
    expect(
      isNavChildVisibleForSurface({ href: "/contracts/reports" }, surface("core"))
    ).toBe(true);
  });

  it("hides assurance-only report hashes unless assurance mode", () => {
    expect(
      isNavChildVisibleForSurface({ href: "/reports#outcome-intelligence" }, surface("advanced"))
    ).toBe(false);
    expect(
      isNavChildVisibleForSurface({ href: "/reports#outcome-intelligence" }, surface("assurance"))
    ).toBe(true);
    expect(
      isNavChildVisibleForSurface({ href: "/reports#assurance-analytics" }, surface("core"))
    ).toBe(false);
    expect(
      isNavChildVisibleForSurface({ href: "/reports#assurance-analytics" }, surface("assurance"))
    ).toBe(true);
  });

  it("shows advanced report hashes in advanced mode", () => {
    expect(
      isNavChildVisibleForSurface({ href: "/reports#campaign-drift" }, surface("advanced"))
    ).toBe(true);
  });
});

describe("§13.4 — flags on, Core mode", () => {
  it("does not surface advanced primary items when seesAdvancedPrimaryNav is false", () => {
    const s: NavSurfaceInput = {
      mode: "core",
      role: "editor",
      featureFlags: allFlagsOn,
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    const decisions = NAV_ITEMS.find((i) => i.href === "/decisions");
    const campaigns = NAV_ITEMS.find((i) => i.href === "/campaigns");
    expect(decisions && isNavItemVisibleForSurface(decisions, s)).toBe(false);
    expect(campaigns && isNavItemVisibleForSurface(campaigns, s)).toBe(false);
  });
});

describe("filterNavBadgesForSurface (§15.3)", () => {
  it("omits hidden keys instead of zeroing counts", () => {
    const s: NavSurfaceInput = {
      mode: "core",
      role: "editor",
      featureFlags: allFlagsOn,
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    const out = filterNavBadgesForSurface({ watchlists: 9, reviewQueue: 2 }, s);
    expect(out.watchlists).toBeUndefined();
    expect(out.reviewQueue).toBe(2);
  });
});

describe("feature flags vs advanced nav (V7 §U)", () => {
  it("hides Campaigns when advanced mode but v5PortfolioCampaigns is off", () => {
    const flags = { ...allFlagsOn, v5PortfolioCampaigns: false };
    const s: NavSurfaceInput = {
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
    const campaigns = NAV_ITEMS.find((i) => i.href === "/campaigns");
    expect(campaigns && isNavItemVisibleForSurface(campaigns, s)).toBe(false);
  });
});

describe("assurance module hides", () => {
  it("hides assurance child links when module is hidden", () => {
    const s = surface("assurance");
    const withHidden = { ...s, assuranceModulesHidden: ["autopilot"] as const };
    expect(
      isNavChildVisibleForSurface({ href: "/assurance/autopilot" }, withHidden)
    ).toBe(false);
    expect(
      isNavChildVisibleForSurface({ href: "/assurance/findings" }, withHidden)
    ).toBe(true);
  });
});
