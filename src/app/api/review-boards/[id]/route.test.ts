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

describe("PATCH /api/review-boards/[id]", () => {
  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { PATCH } = await import("@/app/api/review-boards/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/b1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce(null);
    const { PATCH } = await import("@/app/api/review-boards/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/b1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without maintenance_manage capability", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ userId: "u1", orgId: "o1" });
    canManageCapability.mockResolvedValueOnce(false);
    const { PATCH } = await import("@/app/api/review-boards/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/b1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );
    expect(res.status).toBe(403);
  });
});
