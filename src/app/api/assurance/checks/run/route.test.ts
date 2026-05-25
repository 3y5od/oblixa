import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const runChecks = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature: (...args: unknown[]) => requireV6ApiFeature(...args),
}));

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
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

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: vi.fn(async () => {}),
}));

vi.mock("@/lib/assurance/assurance", () => ({
  runChecks: (...args: unknown[]) => runChecks(...args),
}));

describe("POST /api/assurance/checks/run", () => {
  const ORG = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
    getApiAuthContext.mockResolvedValue({
      admin: {},
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    runChecks.mockResolvedValue({
      checkRun: { id: "cr1" },
      finding: null,
      findings: [],
      metrics: {},
      policyResults: [],
      errors: [],
    });
  });

  it("passes session orgId into runChecks", async () => {
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(201);
    expect(runChecks).toHaveBeenCalledWith(expect.anything(), ORG, "user-1");
  });

  it("returns duplicate response before running checks", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/assurance/checks/run", {
        method: "POST",
        headers: { "x-idempotency-key": "assurance-checks-replay-0001" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.assurance.checks.run",
        actorKey: `${ORG}:user-1`,
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(runChecks).not.toHaveBeenCalled();
  });
});
