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

function chainEqMaybeSingle(data: unknown, error: { message: string } | null = null) {
  return {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data, error })),
      })),
    })),
  };
}

function chainEqOrder(data: unknown) {
  return {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(async () => ({ data, error: null })),
      })),
    })),
  };
}

function chainEqOrderLimit(data: unknown) {
  return {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(async () => ({ data, error: null })),
        })),
      })),
    })),
  };
}

function adminDecisionDetailMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "decision_workspaces") {
        return {
          select: vi.fn(() =>
            chainEqMaybeSingle({
              id: "dec-1",
              title: "T",
              decision_type: "renewal_recommendation",
              status: "open",
              linked_contract_ids: [],
              linked_account_key: null,
              linked_counterparty_key: null,
              owner_user_id: "user-1",
              due_at: null,
              required_inputs_json: {},
              approval_path_json: [],
              recommendation_json: null,
              rationale_markdown: null,
              final_disposition_json: null,
              post_decision_actions_json: [],
              metadata_json: {},
              updated_at: "2026-01-01T00:00:00Z",
            })
          ),
        };
      }
      if (table === "decision_workspace_stakeholders") {
        return { select: vi.fn(() => chainEqOrder([])) };
      }
      if (table === "decision_workspace_events") {
        return { select: vi.fn(() => chainEqOrderLimit([])) };
      }
      if (table === "decision_recommendations") {
        return { select: vi.fn(() => chainEqOrder([])) };
      }
      if (table === "decision_packet_runs") {
        return { select: vi.fn(() => chainEqOrderLimit([])) };
      }
      return {};
    }),
  };
}

describe("/api/decisions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: adminDecisionDetailMock(),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("GET returns 403 when V5 decision foundation is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/decisions/[id]/route");
    const res = await GET(new Request("http://localhost/api/decisions/dec-1"), {
      params: Promise.resolve({ id: "dec-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("GET returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/decisions/[id]/route");
    const res = await GET(new Request("http://localhost/api/decisions/dec-1"), {
      params: Promise.resolve({ id: "dec-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET returns decision bundle", async () => {
    const { GET } = await import("@/app/api/decisions/[id]/route");
    const res = await GET(new Request("http://localhost/api/decisions/dec-1"), {
      params: Promise.resolve({ id: "dec-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.id).toBe("dec-1");
    expect(Array.isArray(body.stakeholders)).toBe(true);
    expect(Array.isArray(body.packetRuns)).toBe(true);
  });

  it("PATCH returns 403 when V5 decision foundation is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { PATCH } = await import("@/app/api/decisions/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/decisions/dec-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("PATCH returns 400 for invalid decisionType", async () => {
    const { PATCH } = await import("@/app/api/decisions/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/decisions/dec-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionType: "bogus_type" }),
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("/api/decisions/[id] PATCH mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    const updatedRow = {
      id: "dec-1",
      title: "T",
      decision_type: "amendment_request",
      status: "open",
      owner_user_id: "user-1",
      due_at: null,
      required_inputs_json: { a: 1 },
      approval_path_json: [],
      rationale_markdown: null,
      updated_at: "2026-01-01T00:00:00Z",
    };
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: vi.fn((table: string) => {
          if (table === "decision_workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { required_inputs_json: { existing: true } },
                      error: null,
                    })),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: updatedRow, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "decision_workspace_events") {
            return { insert: vi.fn(async () => ({ error: null })) };
          }
          return {};
        }),
      },
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
  });

  it("PATCH merges requiredInputs when mergeRequiredInputs is true", async () => {
    const { PATCH } = await import("@/app/api/decisions/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/decisions/dec-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mergeRequiredInputs: true,
          requiredInputs: { newKey: 2 },
        }),
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(200);
  });
});
