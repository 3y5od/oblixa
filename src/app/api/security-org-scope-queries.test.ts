/**
 * Regression tests: session-backed routes that use the service-role client must scope
 * queries/updates by organization_id (defense in depth vs IDOR when RLS is bypassed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/v5/persist-signal-quality", () => ({
  incrementOrgV5SignalQuality: vi.fn(async () => {}),
}));

type EqLog = { table: string; col: string; val: string };

function createAdminWithEqLog(eqLog: EqLog[]) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => {
          eqLog.push({ table, col, val });
          return {
            eq: (col2: string, val2: string) => {
              eqLog.push({ table, col: col2, val: val2 });
              if (table === "decision_workspaces") {
                return {
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "dec-1",
                      title: "T",
                      decision_type: "renewal_recommendation",
                      status: "open",
                      linked_contract_ids: [],
                      linked_account_key: null,
                      linked_counterparty_key: null,
                      owner_user_id: "u1",
                      due_at: null,
                      required_inputs_json: {},
                      approval_path_json: [],
                      recommendation_json: null,
                      rationale_markdown: null,
                      final_disposition_json: null,
                      post_decision_actions_json: [],
                      metadata_json: {},
                      updated_at: "2026-01-01T00:00:00Z",
                    },
                    error: null,
                  })),
                };
              }
              return {
                order: () => {
                  if (table === "decision_workspace_events" || table === "decision_packet_runs") {
                    return {
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    };
                  }
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
      }),
    }),
  };
}

describe("org scope on decision/campaign/intelligence routes", () => {
  const ORG = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    canManageCapability.mockResolvedValue(true);
  });

  it("GET /api/decisions/[id] applies organization_id to decision_workspaces before id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: createAdminWithEqLog(eqLog),
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/decisions/[id]/route");
    const res = await GET(new Request("http://localhost/api/decisions/dec-1"), {
      params: Promise.resolve({ id: "dec-1" }),
    });
    expect(res.status).toBe(200);
    const dw = eqLog.filter((e) => e.table === "decision_workspaces");
    expect(dw.map((e) => e.col)).toEqual(["organization_id", "id"]);
    expect(dw[0]?.val).toBe(ORG);
    expect(dw[1]?.val).toBe("dec-1");
  });

  it("GET /api/campaigns/[id] applies organization_id to portfolio_campaigns before id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  if (table === "portfolio_campaigns") {
                    return {
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: "camp-1",
                          name: "C",
                          campaign_type: "renewal",
                          status: "draft",
                          owner_user_id: null,
                          eligibility_json: {},
                          assignment_json: {},
                          preview_summary_json: null,
                          progress_summary_json: null,
                          rollback_safe: true,
                          rolled_back_at: null,
                          updated_at: "2026-01-01T00:00:00Z",
                        },
                        error: null,
                      })),
                    };
                  }
                  return {
                    order: () => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    }),
                  };
                },
              };
            },
          }),
        }),
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/campaigns/[id]/route");
    const res = await GET(new Request("http://localhost/api/campaigns/camp-1"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    expect(res.status).toBe(200);
    const pc = eqLog.filter((e) => e.table === "portfolio_campaigns");
    expect(pc.map((e) => e.col)).toEqual(["organization_id", "id"]);
    expect(pc[0]?.val).toBe(ORG);
    expect(pc[1]?.val).toBe("camp-1");
  });

  it("PATCH /api/intelligence/recommendations/[id] scopes operational_recommendations update by organization_id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => {
          if (table === "operational_recommendations") {
            return {
              update: () => ({
                eq: (col: string, val: string) => {
                  eqLog.push({ table, col, val });
                  return {
                    eq: (col2: string, val2: string) => {
                      eqLog.push({ table, col: col2, val: val2 });
                      return {
                        select: () => ({
                          maybeSingle: vi.fn(async () => ({
                            data: {
                              id: "rec-1",
                              accepted: true,
                              dismissed: false,
                              recommendation_type: "t",
                              generated_at: "2026-01-01T00:00:00Z",
                            },
                            error: null,
                          })),
                        }),
                      };
                    },
                  };
                },
              }),
            };
          }
          if (table === "audit_events") {
            return {
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          return { select: vi.fn() };
        },
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { PATCH } = await import("@/app/api/intelligence/recommendations/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/intelligence/recommendations/rec-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }),
      { params: Promise.resolve({ id: "rec-1" }) }
    );
    expect(res.status).toBe(200);
    const rec = eqLog.filter((e) => e.table === "operational_recommendations");
    expect(rec.map((e) => e.col)).toEqual(["organization_id", "id"]);
    expect(rec[0]?.val).toBe(ORG);
    expect(rec[1]?.val).toBe("rec-1");
  });

  it("GET /api/simulations/[id] applies organization_id to change_simulations and change_simulation_runs", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  if (table === "change_simulations") {
                    return {
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: "sim-1",
                          simulation_type: "renewal",
                          name: "S",
                          input_json: {},
                          latest_run_id: null,
                          created_at: "2026-01-01T00:00:00Z",
                          updated_at: "2026-01-01T00:00:00Z",
                        },
                        error: null,
                      })),
                    };
                  }
                  if (table === "change_simulation_runs") {
                    return {
                      order: vi.fn(async () => ({ data: [], error: null })),
                    };
                  }
                  return {
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  };
                },
              };
            },
          }),
        }),
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/simulations/[id]/route");
    const res = await GET(new Request("http://localhost/api/simulations/sim-1"), {
      params: Promise.resolve({ id: "sim-1" }),
    });
    expect(res.status).toBe(200);
    const sim = eqLog.filter((e) => e.table === "change_simulations");
    expect(sim.map((e) => e.col)).toEqual(["organization_id", "id"]);
    expect(sim[0]?.val).toBe(ORG);
    expect(sim[1]?.val).toBe("sim-1");
    const runs = eqLog.filter((e) => e.table === "change_simulation_runs");
    expect(runs.map((e) => e.col)).toEqual(["organization_id", "simulation_id"]);
    expect(runs[0]?.val).toBe(ORG);
    expect(runs[1]?.val).toBe("sim-1");
  });
});
