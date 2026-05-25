import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const patchControlPolicySettings = vi.fn();
const incrementAssuranceQualityCounter = vi.fn();
const runIncrementalAssuranceChecks = vi.fn();

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature,
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

vi.mock("@/lib/assurance/control-policies", () => ({
  patchControlPolicySettings,
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter,
}));

vi.mock("@/lib/assurance/assurance-checks", () => ({
  runIncrementalAssuranceChecks,
}));

describe("PATCH /api/control-policies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
    patchControlPolicySettings.mockResolvedValue({ data: { id: "p1" }, error: null });
    incrementAssuranceQualityCounter.mockResolvedValue(undefined);
    runIncrementalAssuranceChecks.mockResolvedValue(undefined);
  });

  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { PATCH } = await import("@/app/api/control-policies/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/control-policies/p1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remediationPlaybookId: null }),
      }),
      { params: Promise.resolve({ id: "p1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce(null);
    const { PATCH } = await import("@/app/api/control-policies/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/control-policies/p1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remediationPlaybookId: null }),
      }),
      { params: Promise.resolve({ id: "p1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns duplicate response before patching control policy settings", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { PATCH } = await import("@/app/api/control-policies/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/control-policies/p1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "control-policy-patch-replay-0001",
        },
        body: JSON.stringify({ remediationPlaybookId: null }),
      }),
      { params: Promise.resolve({ id: "p1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.control-policies.id",
      actorKey: "org-1:user-1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(patchControlPolicySettings).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
