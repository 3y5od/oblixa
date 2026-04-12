import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import { CMDK_EXTRA_NAV_ITEMS } from "@/lib/product-surface/resolver";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_INVENTORY } from "@/lib/product-surface/route-inventory";
import { getCmdkSearchJumpItems } from "@/lib/product-surface/cmdk-search-jumps";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";

const CORE_SURFACE: NavSurfaceInput = {
  mode: "core",
  role: "admin",
  featureFlags: {
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
    v6AssuranceCore: true,
    v6ControlPolicies: true,
    v6AdaptivePlaybooks: true,
    v6Autopilot: true,
    v6OutcomeIntelligence: true,
    v6ReviewBoards: true,
    v6Segments: true,
    v6AutopilotAllowExecution: false,
  },
  seesAdvancedPrimaryNav: false,
  seesAssuranceNav: false,
  advancedModulesHidden: [],
  assuranceModulesHidden: [],
  utilityModulesHidden: [],
  searchScope: "match_mode",
};

describe("onboarding calibration — primary nav / cmd-K seclusion", () => {
  it("does not register /onboarding/calibration on NAV_ITEMS", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href.includes("/onboarding"), item.href).toBe(false);
    }
  });

  it("does not register /onboarding/calibration on CMDK_EXTRA_NAV_ITEMS", () => {
    for (const item of CMDK_EXTRA_NAV_ITEMS) {
      expect(item.href.includes("/onboarding"), item.href).toBe(false);
    }
  });

  it("registers /onboarding/calibration in ROUTE_INVENTORY as a utility tier path", () => {
    const row = ROUTE_INVENTORY.find((r) => r.pattern === "/onboarding/calibration");
    expect(row?.tier).toBe("utility");
  });

  it("cmd-K search jumps never surface /onboarding paths", () => {
    const jumps = getCmdkSearchJumpItems(CORE_SURFACE, "");
    expect(jumps.some((j) => j.href.includes("/onboarding"))).toBe(false);
  });

  it("command palette source does not hard-code /onboarding/calibration as a discoverable target", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/layout/command-palette.tsx"),
      "utf8"
    );
    expect(raw.includes("/onboarding/calibration")).toBe(false);
  });
});
