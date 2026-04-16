import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { moreToolsIndexHasVisibleEntries } from "@/lib/product-surface/more-index-visibility";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { getCmdkSearchJumpItems } from "@/lib/product-surface/cmdk-search-jumps";

const allFlagsOn = Object.fromEntries(
  (
    [
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
    ] as FeatureFlagKey[]
  ).map((k) => [k, true])
) as Record<FeatureFlagKey, boolean>;

function coreSurface(): NavSurfaceInput {
  return {
    mode: "core",
    role: "viewer",
    featureFlags: allFlagsOn,
    seesAdvancedPrimaryNav: false,
    seesAssuranceNav: false,
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
  };
}

describe("nav / cmd-K / utilities parity (§14–15, Appendix B)", () => {
  it("dashboard layout wires moreToolsIndexHasVisibleEntries into header Utilities visibility", () => {
    const header = readFileSync(join(process.cwd(), "src/components/layout/header.tsx"), "utf8");
    expect(header.includes("showUtilitiesLink")).toBe(true);
    const layout = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/layout.tsx"),
      "utf8"
    );
    expect(layout.includes("moreToolsIndexHasVisibleEntries")).toBe(true);
    expect(layout.includes("showUtilitiesLink=")).toBe(true);
  });

  it("Core cmd-K search jumps omit advanced destinations when primary nav would", () => {
    const s = coreSurface();
    const items = getCmdkSearchJumpItems(s, "");
    expect(items.some((i) => i.href.startsWith("/decisions"))).toBe(false);
    expect(items.some((i) => i.href.startsWith("/assurance"))).toBe(false);
  });

  it("moreToolsIndexHasVisibleEntries stays aligned with non-empty /more for typical Core flags", () => {
    expect(moreToolsIndexHasVisibleEntries(coreSurface(), false)).toBe(true);
  });
});
