import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();

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

describe("/api/programs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
  });

  it("GET returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/programs/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST returns duplicate response before creating a program", async () => {
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

    const { POST } = await import("@/app/api/programs/route");
    const res = await POST(
      new Request("http://localhost/api/programs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "programs-replay-0001",
        },
        body: JSON.stringify({ name: "Duplicate program" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.programs",
        actorKey: "org-1:user-1",
      }
    );
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("POST rejects absent browser-origin metadata before reading the body", async () => {
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
    });

    const { POST } = await import("@/app/api/programs/route");
    const res = await POST(
      new Request("http://localhost/api/programs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "programs-origin-0001",
        },
        body: JSON.stringify({ name: "No origin" }),
      })
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: "cross_site_request_rejected",
      diagnostic_id: "programs_cross_site_rejected",
    });
    expect(admin.from).not.toHaveBeenCalled();
  });
});
