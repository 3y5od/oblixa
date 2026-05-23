import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature,
}));

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

describe("POST /api/playbooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns duplicate response before creating a playbook", async () => {
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

    const { POST } = await import("@/app/api/playbooks/route");
    const res = await POST(
      new Request("http://localhost/api/playbooks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "playbook-create-replay-0001",
        },
        body: JSON.stringify({ name: "Remediation playbook" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.playbooks",
      actorKey: "o1:u1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
