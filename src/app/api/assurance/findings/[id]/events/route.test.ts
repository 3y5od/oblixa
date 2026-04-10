import { describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(),
}));

describe("GET /api/assurance/findings/[id]/events", () => {
  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { GET } = await import("@/app/api/assurance/findings/[id]/events/route");
    const res = await GET(new Request("http://localhost/api/assurance/findings/x/events"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/assurance/findings/[id]/events/route");
    const res = await GET(new Request("http://localhost/api/assurance/findings/x/events"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(401);
  });
});
