import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

describe("POST /api/evidence/submit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/evidence/submit/route");
    const res = await POST(new Request("http://localhost:3000/api/evidence/submit", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks capability", async () => {
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, orgId: "org-1", userId: "user-1" });
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/evidence/submit/route");
    const res = await POST(new Request("http://localhost:3000/api/evidence/submit", { method: "POST" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Access denied" });
  });

  it("returns 404 when requirement does not belong to org", async () => {
    const requirementQuery = {
      select: vi.fn(() => requirementQuery),
      eq: vi.fn(() => requirementQuery),
      maybeSingle: vi.fn(async () => ({ data: null })),
    };
    const admin = {
      from: vi.fn(() => requirementQuery),
    };
    getApiAuthContext.mockResolvedValueOnce({ admin, orgId: "org-1", userId: "user-1" });
    canManageCapability.mockResolvedValueOnce(true);

    const { POST } = await import("@/app/api/evidence/submit/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirementId: "missing" }),
      })
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Requirement not found" });
  });
});
