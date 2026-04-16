import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  cmdkFilterRecentHrefsForSurface,
  cmdkResultSortKey,
  isCmdkHrefAllowed,
  isHomeBlockAllowed,
  isRouteAllowedForWorkspacePath,
} from "@/lib/product-surface/resolver";

const coreSurface: NavSurfaceInput = {
  mode: "core",
  role: "viewer",
  featureFlags: {} as NavSurfaceInput["featureFlags"],
  seesAdvancedPrimaryNav: false,
  seesAssuranceNav: false,
  advancedModulesHidden: [],
  assuranceModulesHidden: [],
  utilityModulesHidden: [],
  searchScope: "match_mode",
};

describe("resolver", () => {
  it("isRouteAllowedForWorkspacePath blocks advanced paths on core", () => {
    expect(isRouteAllowedForWorkspacePath("/decisions", "core")).toBe(false);
    expect(isRouteAllowedForWorkspacePath("/contracts/tasks", "core")).toBe(true);
  });

  it("isHomeBlockAllowed keeps upper/lower always on", () => {
    expect(
      isHomeBlockAllowed("dashboard_upper", { home_hidden_sections: ["dashboard_upper"] })
    ).toBe(true);
  });

  it("isHomeBlockAllowed respects hidden list", () => {
    expect(isHomeBlockAllowed("telemetry_compact", { home_hidden_sections: ["telemetry_compact"] })).toBe(
      false
    );
  });

  it("isHomeBlockAllowed hides each HOME_SECTION_IDS block when listed in home_hidden_sections", () => {
    const hiddenCases = [
      "control_room_strip",
      "telemetry_compact",
      "v6_assurance_snapshot",
      "outcome_intelligence",
      "assurance_signals",
    ] as const;
    for (const id of hiddenCases) {
      expect(isHomeBlockAllowed(id, { home_hidden_sections: [id] })).toBe(false);
    }
  });

  it("cmdkResultSortKey orders §20.1 core paths before advanced", () => {
    expect(cmdkResultSortKey("/contracts/tasks")).toBeLessThan(cmdkResultSortKey("/decisions"));
    expect(cmdkResultSortKey("/contracts")).toBeLessThan(cmdkResultSortKey("/contracts/tasks"));
    expect(cmdkResultSortKey("/contracts")).toBeLessThan(cmdkResultSortKey("/work"));
    expect(cmdkResultSortKey("/work")).toBeLessThan(cmdkResultSortKey("/contracts/tasks"));
    expect(cmdkResultSortKey("/contracts/tasks")).toBeLessThan(cmdkResultSortKey("/contracts/obligations"));
    expect(cmdkResultSortKey("/contracts/obligations")).toBeLessThan(cmdkResultSortKey("/contracts/approvals"));
    expect(cmdkResultSortKey("/contracts/approvals")).toBeLessThan(cmdkResultSortKey("/contracts/renewals"));
    expect(cmdkResultSortKey("/contracts/renewals")).toBeLessThan(cmdkResultSortKey("/contracts/exceptions"));
    expect(cmdkResultSortKey("/contracts/exceptions")).toBeLessThan(cmdkResultSortKey("/contracts/evidence-studio"));
    expect(cmdkResultSortKey("/contracts/evidence-studio")).toBeLessThan(cmdkResultSortKey("/contracts/reports"));
  });

  it("isCmdkHrefAllowed hides campaigns on core", () => {
    expect(isCmdkHrefAllowed("/campaigns", coreSurface)).toBe(false);
    expect(isCmdkHrefAllowed("/contracts", coreSurface)).toBe(true);
  });

  it("isCmdkHrefAllowed allows eligible nav-child hrefs", () => {
    expect(isCmdkHrefAllowed("/contracts/tasks", coreSurface)).toBe(true);
    expect(isCmdkHrefAllowed("/contracts/approvals", coreSurface)).toBe(true);
  });

  it("cmdkFilterRecentHrefsForSurface removes hidden modules (§20.3)", () => {
    expect(cmdkFilterRecentHrefsForSurface(["/campaigns", "/work"], coreSurface)).toEqual(["/work"]);
  });

  it("cmdkFilterRecentHrefsForSurface drops poisoned localStorage hrefs", () => {
    expect(
      cmdkFilterRecentHrefsForSurface(
        [
          "/totally-unknown",
          "javascript:alert(1)",
          "/decisions/compare",
          "/campaigns/compare",
          "/relationship-workspaces",
          "/contracts/programs",
          "/assurance/findings",
          "/contracts",
        ],
        coreSurface
      )
    ).toEqual(["/contracts"]);
  });

  it("§13.4 — Core mode hides Advanced cmd-K targets even when all env flags are on", () => {
    const allOn = Object.fromEntries(
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
        ] as const satisfies readonly FeatureFlagKey[]
      ).map((k) => [k, true])
    ) as Record<FeatureFlagKey, boolean>;
    const surface: NavSurfaceInput = {
      mode: "core",
      role: "editor",
      featureFlags: allOn,
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    expect(isCmdkHrefAllowed("/decisions", surface)).toBe(false);
    expect(isCmdkHrefAllowed("/assurance", surface)).toBe(false);
    expect(isCmdkHrefAllowed("/contracts", surface)).toBe(true);
    expect(isCmdkHrefAllowed("/work", surface)).toBe(true);
  });

  it("enforces min role for cmd-K items", () => {
    expect(isCmdkHrefAllowed("/settings/health", coreSurface)).toBe(false);
    const adminSurface: NavSurfaceInput = { ...coreSurface, role: "admin" };
    expect(isCmdkHrefAllowed("/settings/health", adminSurface)).toBe(true);
  });

  it("search scope core_only suppresses non-core cmd-K targets", () => {
    const assuranceSurface: NavSurfaceInput = {
      ...coreSurface,
      mode: "assurance",
      role: "admin",
      seesAdvancedPrimaryNav: true,
      seesAssuranceNav: true,
      searchScope: "core_only",
    };
    expect(isCmdkHrefAllowed("/decisions", assuranceSurface)).toBe(false);
    expect(isCmdkHrefAllowed("/assurance/findings", assuranceSurface)).toBe(false);
    expect(isCmdkHrefAllowed("/contracts", assuranceSurface)).toBe(true);
  });

  it("cmd-K utilities path is gated like other utility surfaces", () => {
    expect(isCmdkHrefAllowed("/more", coreSurface)).toBe(true);
  });
});
