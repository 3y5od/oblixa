import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

let campaignEventsInsert: ReturnType<typeof vi.fn>;

describe("POST /api/simulations/[id]/promote-to-campaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    campaignEventsInsert = vi.fn(async () => ({ error: null }));
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn((table: string) => {
          if (table === "change_simulations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { input_json: { contractStatus: "active" } },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "portfolio_campaigns") {
            return {
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "camp-new",
                      name: "N",
                      campaign_type: "policy_rollout",
                      status: "draft",
                      created_at: "2026-01-01T00:00:00Z",
                    },
                    error: null,
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
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: { id: "run-1" },
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ error: null })),
                })),
              })),
            };
          }
          if (table === "portfolio_campaign_events") {
            return { insert: campaignEventsInsert };
          }
          return {};
        }),
      },
    } as never);
  });

  it("returns 403 when simulation flag off", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/simulations/[id]/promote-to-campaign/route");
    const res = await POST(new Request("http://localhost/api/simulations/s1/promote-to-campaign", { method: "POST" }), {
      params: Promise.resolve({ id: "sim-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid campaignType", async () => {
    const { POST } = await import("@/app/api/simulations/[id]/promote-to-campaign/route");
    const res = await POST(
      new Request("http://localhost/api/simulations/sim-1/promote-to-campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignType: "nope" }),
      }),
      { params: Promise.resolve({ id: "sim-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("creates campaign and returns simulation trace ids", async () => {
    const { POST } = await import("@/app/api/simulations/[id]/promote-to-campaign/route");
    const res = await POST(
      new Request("http://localhost/api/simulations/sim-1/promote-to-campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "sim-1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.campaign.id).toBe("camp-new");
    expect(body.simulationId).toBe("sim-1");
    expect(body.simulationRunId).toBe("run-1");
    expect(campaignEventsInsert).toHaveBeenCalled();
    const evt = campaignEventsInsert.mock.calls[0][0];
    expect(evt.event_type).toBe("campaign.promoted_from_simulation");
    expect(evt.payload_json).toMatchObject({
      simulation_id: "sim-1",
      simulation_run_id: "run-1",
    });
  });
});
