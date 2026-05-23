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

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/v6/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(async () => ({})),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
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

  it("PATCH /api/campaigns/[id] scopes portfolio_campaigns update by organization_id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => {
          if (table === "portfolio_campaigns") {
            return {
              update: () => ({
                eq: (col: string, val: string) => {
                  eqLog.push({ table, col, val });
                  return {
                    eq: (col2: string, val2: string) => {
                      eqLog.push({ table, col: col2, val: val2 });
                      return {
                        eq: (col3: string, val3: string) => {
                          eqLog.push({ table, col: col3, val: val3 });
                          return {
                            select: () => ({
                              maybeSingle: vi.fn(async () => ({
                                data: {
                                  id: "camp-1",
                                  name: "Updated",
                                  campaign_type: "renewal",
                                  status: "draft",
                                  eligibility_json: {},
                                  assignment_json: {},
                                  updated_at: "2026-01-01T00:00:00Z",
                                },
                                error: null,
                              })),
                            }),
                          };
                        },
                      };
                    },
                  };
                },
              }),
            };
          }
          if (table === "portfolio_campaign_events") {
            return {
              insert: vi.fn(async () => ({})),
            };
          }
          return {};
        },
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
    const { PATCH } = await import("@/app/api/campaigns/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/campaigns/camp-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-v10-expected-version": "2026-01-01T00:00:00Z",
        },
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(200);
    const pc = eqLog.filter((e) => e.table === "portfolio_campaigns");
    expect(pc.map((e) => e.col)).toEqual(["organization_id", "id", "updated_at"]);
    expect(pc[0]?.val).toBe(ORG);
    expect(pc[1]?.val).toBe("camp-1");
    expect(pc[2]?.val).toBe("2026-01-01T00:00:00Z");
  });

  it("PATCH /api/intelligence/recommendations/[id] scopes operational_recommendations update by organization_id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => {
          if (table === "operational_recommendations") {
            return {
              select: () => ({
                eq: (col: string, val: string) => {
                  eqLog.push({ table, col, val });
                  return {
                    eq: (col2: string, val2: string) => {
                      eqLog.push({ table, col: col2, val: val2 });
                      return {
                        maybeSingle: vi.fn(async () => ({
                          data: { accepted: false, dismissed: false },
                          error: null,
                        })),
                      };
                    },
                  };
                },
              }),
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
    expect(rec.map((e) => e.col)).toEqual(["organization_id", "id", "organization_id", "id"]);
    expect(rec[0]?.val).toBe(ORG);
    expect(rec[1]?.val).toBe("rec-1");
    expect(rec[2]?.val).toBe(ORG);
    expect(rec[3]?.val).toBe("rec-1");
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

  it("GET /api/workspace/v6-settings scopes organizations row by session org id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                maybeSingle: vi.fn(async () => ({
                  data: { v6_org_settings_json: {} },
                  error: null,
                })),
              };
            },
          }),
        }),
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/workspace/v6-settings/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const orgRows = eqLog.filter((e) => e.table === "organizations");
    expect(orgRows.map((e) => e.col)).toEqual(["id"]);
    expect(orgRows[0]?.val).toBe(ORG);
  });

  it("GET /api/control-policies applies organization_id filter", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                order: () => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                }),
              };
            },
          }),
        }),
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/control-policies/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "control_policies");
    expect(rows.map((e) => e.col)).toEqual(["organization_id"]);
    expect(rows[0]?.val).toBe(ORG);
  });

  it("GET /api/program-evolution/experiments applies organization_id filter", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                order: () => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                }),
              };
            },
          }),
        }),
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/program-evolution/experiments/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "program_evolution_experiments");
    expect(rows.map((e) => e.col)).toEqual(["organization_id"]);
    expect(rows[0]?.val).toBe(ORG);
  });

  it("PATCH /api/review-boards/runs/[id] scopes update by organization_id and run id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => ({
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
                          id: "run-1",
                          status: "reviewed",
                          reviewed_at: "2026-01-01T00:00:00Z",
                          action_capture_json: [],
                          decision_log_json: [],
                        },
                        error: null,
                      })),
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
    const { PATCH } = await import("@/app/api/review-boards/runs/[id]/route");
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      }),
      { params: Promise.resolve({ id: "run-1" }) }
    );
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "review_board_runs");
    expect(rows.map((e) => e.col)).toEqual(["organization_id", "id"]);
    expect(rows[0]?.val).toBe(ORG);
    expect(rows[1]?.val).toBe("run-1");
  });

  it("POST /api/autopilot/run-logs/[id]/revert scopes selects and deletes by organization_id", async () => {
    const eqLog: EqLog[] = [];
    const linkId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => {
          if (table === "organizations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      v6_org_settings_json: {
                        workspace_mode: "assurance",
                        autopilot_allow_execution: true,
                      },
                    },
                    error: null,
                  })),
                }),
              }),
            };
          }
          if (table === "autopilot_run_logs") {
            return {
              select: () => ({
                eq: (col: string, val: string) => {
                  eqLog.push({ table, col, val });
                  return {
                    eq: (col2: string, val2: string) => {
                      void col2;
                      void val2;
                      return {
                        maybeSingle: vi.fn(async () => ({
                          data: {
                            id: "log-1",
                            status: "executed",
                            autopilot_rule_id: "rule-1",
                            output_json: {
                              revert_hint: {
                                table: "external_action_links",
                                id: linkId,
                                action: "delete_or_close",
                              },
                            },
                          },
                          error: null,
                        })),
                      };
                    },
                  };
                },
              }),
              update: () => ({
                eq: (col: string, val: string) => {
                  eqLog.push({ table, col, val });
                  return {
                    eq: (col2: string, val2: string) => {
                      eqLog.push({ table, col: col2, val: val2 });
                      return Promise.resolve({ error: null });
                    },
                  };
                },
              }),
            };
          }
          if (table === "external_action_links") {
            return {
              delete: () => ({
                eq: (col: string, val: string) => {
                  eqLog.push({ table, col, val });
                  return {
                    eq: (col2: string, val2: string) => {
                      eqLog.push({ table, col: col2, val: val2 });
                      return {
                        eq: (col3: string, val3: string) => {
                          eqLog.push({ table, col: col3, val: val3 });
                          return Promise.resolve({ error: null });
                        },
                      };
                    },
                  };
                },
              }),
            };
          }
          return {};
        },
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { POST } = await import("@/app/api/autopilot/run-logs/[id]/revert/route");
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "log-1" }),
    });
    expect(res.status).toBe(200);
    const logSelect = eqLog.filter(
      (e) => e.table === "autopilot_run_logs" && e.col === "organization_id"
    );
    expect(logSelect[0]?.val).toBe(ORG);
    const del = eqLog.filter((e) => e.table === "external_action_links");
    expect(del.map((e) => e.col)).toEqual(["organization_id", "id", "status"]);
    expect(del[0]?.val).toBe(ORG);
    expect(del[1]?.val).toBe(linkId);
  });

  it("PATCH /api/autopilot/rules/[id] scopes update by organization_id and rule id", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => {
          if (table === "organizations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { v6_org_settings_json: { workspace_mode: "assurance" } },
                    error: null,
                  })),
                }),
              }),
            };
          }
          return {
            update: () => ({
              eq: (col: string, val: string) => {
                eqLog.push({ table, col, val });
                return {
                  eq: (col2: string, val2: string) => {
                    eqLog.push({ table, col: col2, val: val2 });
                    return {
                      eq: (col3: string, val3: string) => {
                        eqLog.push({ table, col: col3, val: val3 });
                        return {
                          select: () => ({
                            maybeSingle: vi.fn(async () => ({ data: { id: "rule-1" }, error: null })),
                          }),
                        };
                      },
                    };
                  },
                };
              },
            }),
          };
        },
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { PATCH } = await import("@/app/api/autopilot/rules/[id]/route");
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-v10-expected-version": "2026-01-01T00:00:00Z",
        },
        body: JSON.stringify({ allowlist: ["f1"] }),
      }),
      { params: Promise.resolve({ id: "rule-1" }) }
    );
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "autopilot_rules");
    expect(rows.map((e) => e.col)).toEqual(["organization_id", "id", "updated_at"]);
    expect(rows[0]?.val).toBe(ORG);
    expect(rows[1]?.val).toBe("rule-1");
    expect(rows[2]?.val).toBe("2026-01-01T00:00:00Z");
  });

  function adminListRowsMock(eqLog: EqLog[]) {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, val: string) => {
            eqLog.push({ table, col, val });
            return {
              order: () => ({
                limit: vi.fn(async () => ({ data: [], error: null })),
              }),
            };
          },
        }),
      }),
    };
  }

  it("GET /api/assurance/findings applies organization_id to assurance_findings", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: adminListRowsMock(eqLog),
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/assurance/findings/route");
    const res = await GET(new Request("http://localhost/api/assurance/findings"));
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "assurance_findings");
    expect(rows.map((e) => e.col)).toEqual(["organization_id"]);
    expect(rows[0]?.val).toBe(ORG);
  });

  it("GET /api/assurance/scorecards applies organization_id to assurance_scorecards", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: adminListRowsMock(eqLog),
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/assurance/scorecards/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "assurance_scorecards");
    expect(rows.map((e) => e.col)).toEqual(["organization_id"]);
    expect(rows[0]?.val).toBe(ORG);
  });

  it("GET /api/segments applies organization_id to segment_definitions", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: adminListRowsMock(eqLog),
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/segments/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "segment_definitions");
    expect(rows.map((e) => e.col)).toEqual(["organization_id"]);
    expect(rows[0]?.val).toBe(ORG);
  });

  it("GET /api/playbooks applies organization_id to adaptive_playbooks", async () => {
    const eqLog: EqLog[] = [];
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                order: () => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                }),
              };
            },
          }),
        }),
      },
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    const { GET } = await import("@/app/api/playbooks/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const rows = eqLog.filter((e) => e.table === "adaptive_playbooks");
    expect(rows.map((e) => e.col)).toEqual(["organization_id"]);
    expect(rows[0]?.val).toBe(ORG);
  });

  it("GET /api/assurance/findings/[id]/events applies organization_id before finding id and on events", async () => {
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
                  if (table === "assurance_findings") {
                    return {
                      maybeSingle: vi.fn(async () => ({ data: { id: "f-1" }, error: null })),
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
    const { GET } = await import("@/app/api/assurance/findings/[id]/events/route");
    const res = await GET(new Request("http://localhost/api/assurance/findings/f-1/events"), {
      params: Promise.resolve({ id: "f-1" }),
    });
    expect(res.status).toBe(200);
    const findings = eqLog.filter((e) => e.table === "assurance_findings");
    expect(findings.map((e) => e.col)).toEqual(["organization_id", "id"]);
    expect(findings[0]?.val).toBe(ORG);
    expect(findings[1]?.val).toBe("f-1");
    const ev = eqLog.filter((e) => e.table === "assurance_finding_events");
    expect(ev.map((e) => e.col)).toEqual(["organization_id", "finding_id"]);
    expect(ev[0]?.val).toBe(ORG);
    expect(ev[1]?.val).toBe("f-1");
  });
});
