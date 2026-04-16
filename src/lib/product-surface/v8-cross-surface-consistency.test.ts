import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  isHrefEligibleForProductSurface,
  productSurfaceContextFromNavSurface,
} from "@/lib/product-surface/href-eligibility";
import { isNavChildVisibleForSurface, type NavSurfaceInput } from "@/lib/product-surface/nav-visibility";

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

function navSurface(over: Partial<NavSurfaceInput> & Pick<NavSurfaceInput, "mode">): NavSurfaceInput {
  return {
    role: "viewer",
    featureFlags: allFlagsOn,
    seesAdvancedPrimaryNav: over.mode !== "core",
    seesAssuranceNav: over.mode === "assurance",
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
    ...over,
  };
}

describe("nav visibility vs href eligibility (Objective 2)", () => {
  it("agrees for representative Core and Advanced hrefs", () => {
    const cases: Array<{ surface: NavSurfaceInput; href: string }> = [
      { surface: navSurface({ mode: "core", seesAdvancedPrimaryNav: false }), href: "/decisions" },
      { surface: navSurface({ mode: "core", seesAdvancedPrimaryNav: false }), href: "/contracts" },
      { surface: navSurface({ mode: "core", seesAdvancedPrimaryNav: false }), href: "/reports" },
      {
        surface: navSurface({ mode: "advanced", seesAdvancedPrimaryNav: true }),
        href: "/decisions",
      },
      {
        surface: navSurface({ mode: "assurance", seesAdvancedPrimaryNav: true, seesAssuranceNav: true }),
        href: "/assurance/findings",
      },
    ];

    for (const { surface, href } of cases) {
      const nav = isNavChildVisibleForSurface({ href }, surface);
      const ctx = productSurfaceContextFromNavSurface(surface, "org-cross-surface");
      const hrefOk = isHrefEligibleForProductSurface(ctx, href);
      expect(hrefOk, `${href} @ ${surface.mode}`).toBe(nav);
    }
  });
});
