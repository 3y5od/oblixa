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

vi.mock("@/lib/v6/workflows", () => ({
  workflowFindingToIntervention: vi.fn(async () => ({ stub: "w1" })),
  workflowPolicyBreachRemediation: vi.fn(async () => ({ stub: "w2" })),
  workflowExternalEvidenceRefresh: vi.fn(async () => ({ stub: "w3" })),
  workflowProgramPerformanceTuning: vi.fn(async () => ({ stub: "w4" })),
  workflowPortfolioBoardReview: vi.fn(async () => ({ stub: "w5" })),
}));

vi.mock("@/lib/v6/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(async () => ({})),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
}));

describe("POST /api/assurance/workflows/run-all", () => {
  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(JSON.stringify({ error: "disabled" }), { status: 403 }));
    const { POST } = await import("@/app/api/assurance/workflows/run-all/route");
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/assurance/workflows/run-all/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 without maintenance_manage", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "viewer" });
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/assurance/workflows/run-all/route");
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns workflows map when authorized", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    canManageCapability.mockImplementation(async (_ctx, cap) => cap === "maintenance_manage");
    isFeatureEnabled.mockReturnValue(false);

    const { POST } = await import("@/app/api/assurance/workflows/run-all/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      workflows: Record<string, unknown>;
    };
    expect(body.ok).toBe(true);
    expect(body.workflows.findingToIntervention).toEqual({ stub: "w1" });
    expect(body.workflows.portfolioBoardReview).toEqual({ stub: "w5" });
  });
});
