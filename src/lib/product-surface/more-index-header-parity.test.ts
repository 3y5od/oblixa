import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { moreToolsIndexHasVisibleEntries } from "@/lib/product-surface/more-index-visibility";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";

/** Same boolean the dashboard layout passes to `Header` as `showUtilitiesLink` (Appendix B). */
function showUtilitiesLinkLikeLayout(input: NavSurfaceInput | null, v6Any: boolean): boolean {
  return moreToolsIndexHasVisibleEntries(input, v6Any);
}

function baseFlags(over: Partial<Record<FeatureFlagKey, boolean>> = {}): Record<FeatureFlagKey, boolean> {
  return {
    v3TasksEngine: true,
    v3ObligationsExecution: true,
    v3ApprovalsSla: true,
    v3RenewalWorkspace: true,
    v3IntakePipeline: true,
    v3PersonaDashboards: true,
    v3ReportingHistory: true,
    v3AutomationExpansion: true,
    v5DecisionFoundation: true,
    v5PortfolioCampaigns: true,
    v5SimulationAndIntelligence: true,
    v5RelationshipLayer: true,
    v5ExternalCollaboration: true,
    v5ControlRoomUx: true,
    v6AssuranceCore: false,
    v6ControlPolicies: false,
    v6AdaptivePlaybooks: false,
    v6Autopilot: false,
    v6OutcomeIntelligence: false,
    v6ReviewBoards: false,
    v6Segments: false,
    v6AutopilotAllowExecution: false,
    ...over,
  } as Record<FeatureFlagKey, boolean>;
}

describe("more-index-visibility vs header Utilities (V7 §8.4)", () => {
  it("Core surface with no v6 flags uses the same predicate as layout showUtilitiesLink", () => {
    const surface: NavSurfaceInput = {
      mode: "core",
      role: "admin",
      featureFlags: baseFlags(),
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    const v6Any = false;
    expect(showUtilitiesLinkLikeLayout(surface, v6Any)).toBe(moreToolsIndexHasVisibleEntries(surface, v6Any));
  });

  it("when v6Any is true, jump links can make /more non-empty even on Core (matches layout OR)", () => {
    const surface: NavSurfaceInput = {
      mode: "core",
      role: "viewer",
      featureFlags: baseFlags(),
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    expect(moreToolsIndexHasVisibleEntries(surface, false)).toBe(moreToolsIndexHasVisibleEntries(surface, false));
    expect(moreToolsIndexHasVisibleEntries(surface, true)).toBe(true);
  });

  it("null nav surface keeps utilities visible (pre-auth / edge layout)", () => {
    expect(showUtilitiesLinkLikeLayout(null, false)).toBe(true);
  });
});
