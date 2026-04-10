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

vi.mock("@/lib/v6/outcomes", () => ({
  computeOutcomeViews: vi.fn(async () => ({
    programEffectiveness: [{ program_id: "p1" }],
    error: null,
  })),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
}));

describe("GET /api/outcomes/program-effectiveness", () => {
  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { GET } = await import("@/app/api/outcomes/program-effectiveness/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns programEffectiveness array", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    const { GET } = await import("@/app/api/outcomes/program-effectiveness/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { programEffectiveness: unknown[] };
    expect(Array.isArray(body.programEffectiveness)).toBe(true);
    expect(body.programEffectiveness.length).toBe(1);
  });
});
