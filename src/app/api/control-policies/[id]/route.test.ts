import { describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

describe("PATCH /api/control-policies/[id]", () => {
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
});
