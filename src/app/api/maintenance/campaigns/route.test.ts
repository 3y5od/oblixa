import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
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

describe("POST /api/maintenance/campaigns", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/maintenance/campaigns/route");
    const res = await POST(
      new Request("http://localhost/api/maintenance/campaigns", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("returns duplicate response before creating a maintenance campaign", async () => {
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

    const { POST } = await import("@/app/api/maintenance/campaigns/route");
    const res = await POST(
      new Request("http://localhost/api/maintenance/campaigns", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "maintenance-campaign-replay-0001",
        },
        body: JSON.stringify({ name: "Cleanup duplicate" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.maintenance.campaigns",
        actorKey: "org-1:user-1",
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
