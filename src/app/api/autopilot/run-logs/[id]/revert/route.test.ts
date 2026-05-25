import { describe, expect, it, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAssuranceWorkspaceForAutopilotApi: vi.fn(),
}));

vi.mock("@/lib/assurance/require-assurance-workspace-for-autopilot-api", () => ({
  requireAssuranceWorkspaceForAutopilotApi: (...args: unknown[]) =>
    hoisted.requireAssuranceWorkspaceForAutopilotApi(...args),
}));

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature: () => null,
}));

const isOrgAutopilotExecutionAllowed = vi.fn();
const getOrgSettingsJson = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/assurance/org-settings", () => ({
  isOrgAutopilotExecutionAllowed: (...args: unknown[]) => isOrgAutopilotExecutionAllowed(...args),
  getOrgSettingsJson: (...args: unknown[]) => getOrgSettingsJson(...args),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

const revertAutopilotRunLog = vi.fn();

vi.mock("@/lib/assurance/autopilot-revert", () => ({
  revertAutopilotRunLog: (...args: unknown[]) => revertAutopilotRunLog(...args),
}));

vi.mock("@/lib/assurance/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(),
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: () => false,
}));

const requireV6Context = vi.fn();

vi.mock("@/lib/assurance/api-auth", () => ({
  requireV6Context: (...args: unknown[]) => requireV6Context(...args),
}));

describe("POST /api/autopilot/run-logs/[id]/revert", () => {
  beforeEach(() => {
    isOrgAutopilotExecutionAllowed.mockReset();
    getOrgSettingsJson.mockReset();
    getOrgSettingsJson.mockResolvedValue({ workspace_mode: "assurance" });
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
