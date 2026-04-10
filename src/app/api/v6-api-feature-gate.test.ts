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

describe("v6 API feature guards", () => {
  it("blocks assurance findings when feature is disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "disabled" }), { status: 403 })
    );
    const { GET } = await import("@/app/api/assurance/findings/route");
    const res = await GET(new Request("http://localhost/api/assurance/findings"));
    expect(res.status).toBe(403);
  });

  it("allows assurance findings when feature is enabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({
      admin: {
        from: (table: string) => {
          if (table === "org_behavior_metrics") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn(async () => ({ data: { id: "m1", v6_assurance_quality_json: {} }, error: null })),
                  }),
                }),
              }),
              update: () => ({
                eq: () => ({
                  eq: vi.fn(async () => ({ data: null, error: null })),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                }),
              }),
            }),
          };
        },
      },
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/assurance/findings/route");
    const res = await GET(new Request("http://localhost/api/assurance/findings"));
    expect(res.status).toBe(200);
  });

  it("blocks control policy create when feature is disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "disabled" }), { status: 403 })
    );
    const { POST } = await import("@/app/api/control-policies/route");
    const res = await POST(
      new Request("http://localhost/api/control-policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "P", objective: "O" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("blocks autopilot rules route when feature is disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "disabled" }), { status: 403 })
    );
    const { GET } = await import("@/app/api/autopilot/rules/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("blocks autopilot run log revert when feature is disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "disabled" }), { status: 403 })
    );
    const { POST } = await import("@/app/api/autopilot/run-logs/[id]/revert/route");
    const res = await POST(new Request("http://localhost/api/autopilot/run-logs/x/revert", { method: "POST" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(403);
  });

  it("blocks review board run PATCH when feature is disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "disabled" }), { status: 403 })
    );
    const { PATCH } = await import("@/app/api/review-boards/runs/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/runs/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(403);
  });

  it("blocks review board run GET export when feature is disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "disabled" }), { status: 403 })
    );
    const { GET } = await import("@/app/api/review-boards/runs/[id]/route");
    const res = await GET(new Request("http://localhost/api/review-boards/runs/x?format=json"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(403);
  });
});
