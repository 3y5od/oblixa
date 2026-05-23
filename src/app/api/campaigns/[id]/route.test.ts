import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const requireV5ApiFeature = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature,
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

describe("PATCH /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV5ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns duplicate response before updating a campaign", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { PATCH } = await import("@/app/api/campaigns/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/campaigns/c1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "campaign-patch-replay-0001",
        },
        body: JSON.stringify({ name: "Updated campaign" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.campaigns.id",
      actorKey: "o1:u1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
