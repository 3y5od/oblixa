import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { AdminClient } from "@/lib/v6/service";
import type { V6OrgSettingsJson } from "@/lib/v6/org-settings";

const mockGetV6OrgSettingsJson = vi.hoisted(() => vi.fn());
const mockGetFeatureFlags = vi.hoisted(() => vi.fn());

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: mockGetV6OrgSettingsJson,
}));

vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/feature-flags")>();
  return {
    ...actual,
    getFeatureFlags: () => mockGetFeatureFlags(),
  };
});

import { buildProductSurfaceContext, loadProductSurfaceContext } from "@/lib/product-surface/context";

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

const v6: V6OrgSettingsJson = {
  workspace_mode: "advanced",
  advanced_modules_hidden: ["campaigns"],
  assurance_modules_hidden: [],
  utility_modules_hidden: [],
  search_scope: "core_only",
  autopilot_allow_execution: true,
  default_landing_path: "/dashboard",
};

const featureFlags = Object.fromEntries(ALL_FLAG_KEYS.map((k) => [k, true])) as Record<
  FeatureFlagKey,
  boolean
>;

function assertParity(
  loaded: ReturnType<typeof buildProductSurfaceContext>,
  built: ReturnType<typeof buildProductSurfaceContext>
): void {
  expect(loaded.orgId).toBe(built.orgId);
  expect(loaded.mode).toBe(built.mode);
  expect(loaded.workspaceMode).toBe(built.workspaceMode);
  expect(loaded.role).toBe(built.role);
  expect(loaded.isAdmin).toBe(built.isAdmin);
  expect([...loaded.advancedModulesHidden].sort()).toEqual([...built.advancedModulesHidden].sort());
  expect([...loaded.assuranceModulesHidden].sort()).toEqual([...built.assuranceModulesHidden].sort());
  expect([...loaded.utilityModulesHidden].sort()).toEqual([...built.utilityModulesHidden].sort());
  expect(loaded.searchScope).toBe(built.searchScope);
  expect(loaded.autopilotAllowExecution).toBe(built.autopilotAllowExecution);
  expect(loaded.defaultLandingPath).toBe(built.defaultLandingPath);
  expect(loaded.seesAdvancedPrimaryNav).toBe(built.seesAdvancedPrimaryNav);
  expect(loaded.seesAssuranceNav).toBe(built.seesAssuranceNav);
}

describe("loadProductSurfaceContext vs buildProductSurfaceContext (§8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV6OrgSettingsJson.mockResolvedValue(v6);
    mockGetFeatureFlags.mockReturnValue(featureFlags);
  });

  it("matches buildProductSurfaceContext for the same org settings and flags snapshot", async () => {
    const admin = {} as unknown as AdminClient;
    const loaded = await loadProductSurfaceContext(admin, "org-parity", "editor");
    const built = buildProductSurfaceContext({
      orgId: "org-parity",
      role: "editor",
      v6,
      featureFlags,
    });
    assertParity(loaded, built);
  });
});
