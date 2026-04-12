import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v4/policy-registry", () => ({
  validatePolicyRegistry: vi.fn(() => ({ ok: true, errors: [] })),
  analyzePolicyRegistry: vi.fn(() => ({})),
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

function thenableResult<T>(value: T) {
  const self = {
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
    lte: vi.fn(() => self),
    limit: vi.fn(() => self),
    then: (onFulfilled: (v: T) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(onFulfilled, onRejected),
  };
  return self;
}

describe("POST /api/simulations/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 403 when V5 simulation/intelligence is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/simulations/run/route");
    const res = await POST(
      new Request("http://localhost/api/simulations/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "s" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns run with metric_matrix in result_json", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn((table: string) => {
          if (table === "contracts") {
            return {
              select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.count === "exact" && opts?.head) {
                  return thenableResult({ count: 4, error: null });
                }
                return thenableResult({ data: [{ id: "c1" }], error: null });
              }),
            };
          }
          if (table === "change_simulations") {
            return {
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "sim-1",
                      simulation_type: "campaign_eligibility_impact",
                      name: "Test sim",
                    },
                    error: null,
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
          if (table === "contract_obligations") {
            return {
              select: vi.fn(() => thenableResult({ count: 1, error: null })),
            };
          }
          if (table === "portfolio_campaigns") {
            return {
              select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.count === "exact" && opts?.head) {
                  return thenableResult({ count: 2, error: null });
                }
                return thenableResult({ data: [], error: null });
              }),
            };
          }
          if (table === "organization_workflow_settings") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          if (table === "change_simulation_runs") {
            return {
              insert: vi.fn((payload: { result_json?: Record<string, unknown> }) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "run-1",
                      status: "completed",
                      result_json: payload?.result_json ?? {},
                      created_at: "2026-01-01T00:00:00Z",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      },
    } as never);

    const { POST } = await import("@/app/api/simulations/run/route");
    const res = await POST(
      new Request("http://localhost/api/simulations/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "n", input: {} }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.run?.result_json?.metric_matrix).toMatchObject({
      simulation_kind: "campaign_eligibility_impact",
      simulation_focus: expect.any(String),
      affected_contracts: expect.any(Number),
      segment_sample_contract_ids: expect.any(Array),
      estimated_load: expect.any(Object),
      execution_signals: expect.any(Object),
      type_specific_signals: expect.objectContaining({
        active_or_paused_campaigns: 2,
      }),
    });
  });

  it("returns 400 for invalid simulationType", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      userId: "u1",
      orgId: "o1",
      admin: { from: vi.fn() },
    } as never);
    const { POST } = await import("@/app/api/simulations/run/route");
    const res = await POST(
      new Request("http://localhost/api/simulations/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ simulationType: "not_a_simulation" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
