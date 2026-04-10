import { describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const isFeatureEnabled = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled,
}));

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: vi.fn(async () => ({ autopilot_allow_execution: false })),
  mergeV6OrgSettingsJson: vi.fn(async () => ({
    data: { autopilot_allow_execution: true },
    error: null,
  })),
}));

vi.mock("@/lib/v6/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(async () => ({})),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
}));

describe("/api/workspace/v6-settings", () => {
  it("GET returns 401 when unauthenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/workspace/v6-settings/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns settings when authenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    const { GET } = await import("@/app/api/workspace/v6-settings/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings: { autopilot_allow_execution?: boolean } };
    expect(body.settings.autopilot_allow_execution).toBe(false);
  });

  it("PATCH returns 403 without settings_manage", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "viewer" });
    canManageCapability.mockResolvedValueOnce(false);
    const { PATCH } = await import("@/app/api/workspace/v6-settings/route");
    const res = await PATCH(
      new Request("http://localhost/api/workspace/v6-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autopilotAllowExecution: true }),
      })
    );
    expect(res.status).toBe(403);
  });
});
