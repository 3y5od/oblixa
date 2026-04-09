import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/v5/capacity-forecast-keys";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("GET /api/capacity/forecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    {
                      id: "f1",
                      forecast_horizon_days: 30,
                      forecast_json: {
                        [CAPACITY_FORECAST_JSON_KEYS.open_tasks]: 2,
                        [CAPACITY_FORECAST_JSON_KEYS.open_tasks_by_team_key]: { ops: 2 },
                        [CAPACITY_FORECAST_JSON_KEYS.pending_approvals_by_type]: {
                          renewal_decision: 1,
                        },
                      },
                      model_version: "v1",
                      generated_at: "2026-01-01T00:00:00Z",
                      expires_at: "2026-01-02T00:00:00Z",
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
      orgId: "org-1",
    });
  });

  it("returns 403 when V5 simulation/intelligence is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/capacity/forecast/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns forecast_json with team and approval breakdown keys", async () => {
    const { GET } = await import("@/app/api/capacity/forecast/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forecasts[0].forecast_json.open_tasks_by_team_key).toEqual({ ops: 2 });
    expect(body.forecasts[0].forecast_json.pending_approvals_by_type).toEqual({
      renewal_decision: 1,
    });
  });
});
