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

describe("POST /api/decisions/[id]/packet", () => {
  let decisionWorkspaceFromCalls = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    decisionWorkspaceFromCalls = 0;
    vi.mocked(requireV5ApiFeature).mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    delete process.env.V5_DECISION_PACKET_BUCKET;
  });

  it("returns 400 for invalid packetType", async () => {
    getApiAuthContext.mockResolvedValue({ userId: "u1", orgId: "o1", admin: { from: vi.fn() } } as never);
    const { POST } = await import("@/app/api/decisions/[id]/packet/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packetType: "unknown_packet" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(400);
  });

  function mockDecisionWorkspaceDetail() {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "d1",
                title: "T",
                decision_type: "renewal",
                status: "open",
                linked_contract_ids: [],
                rationale_markdown: null,
                recommendation_json: null,
                final_disposition_json: null,
                due_at: null,
                linked_account_key: null,
                linked_counterparty_key: null,
              },
              error: null,
            })),
          })),
        })),
      })),
    };
  }

  function mockDecisionWorkspaceQueue() {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [
                  {
                    id: "d2",
                    title: "Queue peer",
                    decision_type: "amendment_request",
                    status: "open",
                    due_at: "2026-03-01T00:00:00Z",
                    owner_user_id: null,
                    updated_at: "2026-01-02T00:00:00Z",
                  },
                ],
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
  }

  it("includes catalog hint in stored payload", async () => {
    const runsInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: "pr-1", packet_type: "renewal_packet", payload_json: {}, exported_at: "t", created_at: "t" },
          error: null,
        })),
      })),
    }));
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn((table: string) => {
          if (table === "decision_workspaces") {
            decisionWorkspaceFromCalls += 1;
            if (decisionWorkspaceFromCalls === 1) {
              return mockDecisionWorkspaceDetail();
            }
            return mockDecisionWorkspaceQueue();
          }
          if (table === "decision_packet_runs") {
            return {
              insert: runsInsert,
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ error: null })),
                })),
              })),
            };
          }
          if (table === "decision_workspace_events") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
                })),
              })),
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          return {};
        }),
      },
    } as never);
    const { POST } = await import("@/app/api/decisions/[id]/packet/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packetType: "renewal_packet" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(201);
    expect(runsInsert).toHaveBeenCalled();
    const insertArg = runsInsert.mock.calls.at(0)?.at(0) as unknown as {
      payload_json: Record<string, unknown>;
    };
    expect(insertArg.payload_json.template_catalog_hint).toBeTruthy();
    expect(insertArg.payload_json.packet_type).toBe("renewal_packet");
    const body = await res.json();
    expect(body.artifactStored).toBe(false);
    expect(body.artifacts).toEqual({ jsonStored: false, pdfStored: false });
  });

  it("uploads artifact and sets artifactStored when bucket env is set", async () => {
    const prev = process.env.V5_DECISION_PACKET_BUCKET;
    process.env.V5_DECISION_PACKET_BUCKET = "test-bucket";
    const upload = vi.fn(async () => ({ error: null }));
    const runsUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    const runsInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: "pr-9", packet_type: "renewal_packet", payload_json: {}, exported_at: "t", created_at: "t" },
          error: null,
        })),
      })),
    }));
    try {
      getApiAuthContext.mockResolvedValue({
        userId: "u1",
        orgId: "o1",
        admin: {
          from: vi.fn((table: string) => {
            if (table === "decision_workspaces") {
              decisionWorkspaceFromCalls += 1;
              if (decisionWorkspaceFromCalls === 1) {
                return mockDecisionWorkspaceDetail();
              }
              return mockDecisionWorkspaceQueue();
            }
            if (table === "decision_packet_runs") {
              return { insert: runsInsert, update: runsUpdate };
            }
            if (table === "decision_workspace_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(async () => ({ data: [], error: null })),
                      })),
                    })),
                  })),
                })),
                insert: vi.fn(async () => ({ error: null })),
              };
            }
            return {};
          }),
          storage: {
            from: vi.fn(() => ({ upload })),
          },
        },
      } as never);
      const { POST } = await import("@/app/api/decisions/[id]/packet/route");
      const res = await POST(
        new Request("http://localhost/api/decisions/d1/packet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ packetType: "renewal_packet" }),
        }),
        { params: Promise.resolve({ id: "d1" }) }
      );
      expect(res.status).toBe(201);
      expect(upload).toHaveBeenCalledTimes(2);
      expect(runsUpdate).toHaveBeenCalled();
      const body = await res.json();
      expect(body.artifactStored).toBe(true);
      expect(body.artifacts).toEqual({ jsonStored: true, pdfStored: true });
    } finally {
      if (prev === undefined) delete process.env.V5_DECISION_PACKET_BUCKET;
      else process.env.V5_DECISION_PACKET_BUCKET = prev;
    }
  });

  it("adds manager_queue_snapshot for manager_review_packet", async () => {
    const runsInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "pr-2",
            packet_type: "manager_review_packet",
            payload_json: {},
            exported_at: "t",
            created_at: "t",
          },
          error: null,
        })),
      })),
    }));
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: {
        from: vi.fn((table: string) => {
          if (table === "decision_workspaces") {
            decisionWorkspaceFromCalls += 1;
            if (decisionWorkspaceFromCalls === 1) {
              return mockDecisionWorkspaceDetail();
            }
            return mockDecisionWorkspaceQueue();
          }
          if (table === "decision_packet_runs") {
            return {
              insert: runsInsert,
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ error: null })),
                })),
              })),
            };
          }
          if (table === "decision_workspace_events") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
                })),
              })),
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          return {};
        }),
      },
    } as never);
    const { POST } = await import("@/app/api/decisions/[id]/packet/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packetType: "manager_review_packet" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(201);
    const insertArg = runsInsert.mock.calls.at(0)?.at(0) as unknown as {
      payload_json: Record<string, unknown>;
    };
    const snap = insertArg.payload_json.manager_queue_snapshot;
    expect(Array.isArray(snap)).toBe(true);
    expect((snap as { title?: string }[])[0]?.title).toBe("Queue peer");
    expect((snap as { sla_status?: string }[])[0]?.sla_status).toBeTruthy();
  });
});
