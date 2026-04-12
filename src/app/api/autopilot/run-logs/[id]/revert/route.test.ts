import { describe, expect, it, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAssuranceWorkspaceForAutopilotApi: vi.fn(),
}));

vi.mock("@/lib/v6/require-assurance-workspace-for-autopilot-api", () => ({
  requireAssuranceWorkspaceForAutopilotApi: (...args: unknown[]) =>
    hoisted.requireAssuranceWorkspaceForAutopilotApi(...args),
}));

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature: () => null,
}));

const isOrgAutopilotExecutionAllowed = vi.fn();
const getV6OrgSettingsJson = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/v6/org-settings", () => ({
  isOrgAutopilotExecutionAllowed: (...args: unknown[]) => isOrgAutopilotExecutionAllowed(...args),
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

const revertAutopilotRunLog = vi.fn();

vi.mock("@/lib/v6/autopilot-revert", () => ({
  revertAutopilotRunLog: (...args: unknown[]) => revertAutopilotRunLog(...args),
}));

vi.mock("@/lib/v6/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: () => false,
}));

const requireV6Context = vi.fn();

vi.mock("@/lib/v6/api-auth", () => ({
  requireV6Context: (...args: unknown[]) => requireV6Context(...args),
}));

describe("POST /api/autopilot/run-logs/[id]/revert", () => {
  beforeEach(() => {
    isOrgAutopilotExecutionAllowed.mockReset();
    getV6OrgSettingsJson.mockReset();
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "assurance" });
    revertAutopilotRunLog.mockReset();
    requireV6Context.mockReset();
    hoisted.requireAssuranceWorkspaceForAutopilotApi.mockReset();
    hoisted.requireAssuranceWorkspaceForAutopilotApi.mockResolvedValue(null);
    requireApiWorkspaceEligibility.mockReset();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns 403 when org does not allow mutating autopilot (§17.2)", async () => {
    requireV6Context.mockResolvedValue({
      ctx: { admin: {}, orgId: "o1", userId: "u1" },
      errorResponse: null,
    });
    isOrgAutopilotExecutionAllowed.mockResolvedValue(false);

    const { POST } = await import("@/app/api/autopilot/run-logs/[id]/revert/route");
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "log-1" }),
    });

    expect(res.status).toBe(403);
    expect(revertAutopilotRunLog).not.toHaveBeenCalled();
  });
});
