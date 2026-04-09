import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("GET /api/simulations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      orgId: "o1",
      admin: {
        from: vi.fn((table: string) => {
          if (table === "change_simulations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        id: "sim-1",
                        simulation_type: "campaign_eligibility_impact",
                        name: "S",
                        input_json: {},
                        latest_run_id: "run-1",
                        created_at: "2026-01-01T00:00:00Z",
                        updated_at: "2026-01-01T00:00:00Z",
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "change_simulation_runs") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(async () => ({
                      data: [
                        {
                          id: "run-1",
                          status: "completed",
                          result_json: { metric_matrix: { affected_contracts: 2 } },
                          promoted_campaign_id: null,
                          created_at: "2026-01-01T00:00:00Z",
                        },
                      ],
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      },
    } as never);
  });

  it("returns 403 when feature disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/simulations/[id]/route");
    const res = await GET(new Request("http://localhost/api/simulations/sim-1"), {
      params: Promise.resolve({ id: "sim-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns simulation and runs", async () => {
    const { GET } = await import("@/app/api/simulations/[id]/route");
    const res = await GET(new Request("http://localhost/api/simulations/sim-1"), {
      params: Promise.resolve({ id: "sim-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.simulation.id).toBe("sim-1");
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].result_json?.metric_matrix).toBeDefined();
  });
});
