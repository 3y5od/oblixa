import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const isFeatureEnabled = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const workflowFindingToIntervention = vi.fn(async () => ({ stub: "w1" }));
const workflowPolicyBreachRemediation = vi.fn(async () => ({ stub: "w2" }));
const workflowExternalEvidenceRefresh = vi.fn(async () => ({ stub: "w3" }));
const workflowProgramPerformanceTuning = vi.fn(async () => ({ stub: "w4" }));
const workflowPortfolioBoardReview = vi.fn(async () => ({ stub: "w5" }));

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

vi.mock("@/lib/assurance/workflows", () => ({
  workflowFindingToIntervention,
  workflowPolicyBreachRemediation,
  workflowExternalEvidenceRefresh,
  workflowProgramPerformanceTuning,
  workflowPortfolioBoardReview,
}));

vi.mock("@/lib/assurance/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(async () => ({})),
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: vi.fn(async () => {}),
}));

describe("POST /api/assurance/workflows/run-all", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
    workflowFindingToIntervention.mockResolvedValue({ stub: "w1" });
    workflowPolicyBreachRemediation.mockResolvedValue({ stub: "w2" });
    workflowExternalEvidenceRefresh.mockResolvedValue({ stub: "w3" });
    workflowProgramPerformanceTuning.mockResolvedValue({ stub: "w4" });
    workflowPortfolioBoardReview.mockResolvedValue({ stub: "w5" });
  });

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

  it("returns duplicate response before launching workflows", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    canManageCapability.mockResolvedValueOnce(true);
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("@/app/api/assurance/workflows/run-all/route");
    const res = await POST(
      new Request("http://localhost/api/assurance/workflows/run-all", {
        method: "POST",
        headers: { "x-idempotency-key": "assurance-workflows-replay-0001" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.assurance.workflows.run-all",
        actorKey: "o1:u1",
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(workflowFindingToIntervention).not.toHaveBeenCalled();
    expect(workflowPortfolioBoardReview).not.toHaveBeenCalled();
  });
});
