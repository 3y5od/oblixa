import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { buildProductSurfaceContext, parseWorkspaceMode } from "@/lib/product-surface/context";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

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

describe("product surface context", () => {
  it("falls back to core workspace mode on invalid input", () => {
    expect(parseWorkspaceMode({ workspace_mode: "nope" as never })).toBe("core");
  });

  it("exposes v8-required derived fields", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "org-1",
      role: "admin",
      v6: {
        workspace_mode: "assurance",
        autopilot_allow_execution: true,
      },
      featureFlags: noFlags,
    });

    expect(ctx.mode).toBe("assurance");
    expect(ctx.workspaceMode).toBe("assurance");
    expect(ctx.isAdmin).toBe(true);
    expect(ctx.autopilotAllowExecution).toBe(true);
  });

  it("normalizes invalid default landing path to /dashboard", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "org-1",
      role: "viewer",
      v6: {
        workspace_mode: "core",
        default_landing_path: "/decisions",
      },
      featureFlags: noFlags,
    });
    expect(ctx.defaultLandingPath).toBe("/dashboard");
  });

  it("treats missing hidden-module arrays as empty sets (§8.3)", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "org-1",
      role: "viewer",
      v6: { workspace_mode: "advanced" },
      featureFlags: noFlags,
    });
    expect(ctx.advancedModulesHidden.size).toBe(0);
    expect(ctx.assuranceModulesHidden.size).toBe(0);
    expect(ctx.utilityModulesHidden.size).toBe(0);
  });

  it("surfaces autopilot execution kill-switch from org JSON (§20.1)", () => {
    const off = buildProductSurfaceContext({
      orgId: "org-1",
      role: "admin",
      v6: { workspace_mode: "assurance", autopilot_allow_execution: false },
      featureFlags: noFlags,
    });
    expect(off.autopilotAllowExecution).toBe(false);
    const on = buildProductSurfaceContext({
      orgId: "org-1",
      role: "admin",
      v6: { workspace_mode: "assurance", autopilot_allow_execution: true },
      featureFlags: noFlags,
    });
    expect(on.autopilotAllowExecution).toBe(true);
  });

  it("does not widen Advanced surfaces from feature flags alone — mode still gates (§20.2)", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "org-1",
      role: "viewer",
      v6: { workspace_mode: "core" },
      featureFlags: allFlagsOn,
    });
    expect(ctx.mode).toBe("core");
    expect(ctx.seesAdvancedPrimaryNav).toBe(false);
  });
});
