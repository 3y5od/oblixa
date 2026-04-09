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

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

function adminMock(opts: { listError?: boolean; insertError?: boolean }) {
  return {
    from: vi.fn((table: string) => {
      if (table === "decision_workspaces") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() =>
                  opts.listError
                    ? { data: null, error: { message: "list failed" } }
                    : {
                        data: [
                          {
                            id: "d1",
                            title: "Renewal decision",
                            decision_type: "renewal",
                            status: "open",
                            linked_contract_ids: [],
                          },
                        ],
                        error: null,
                      }
                ),
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                opts.insertError
                  ? { data: null, error: { message: "insert failed" } }
                  : {
                      data: {
                        id: "d2",
                        title: "New decision",
                        decision_type: "renewal",
                        status: "open",
                        required_inputs_json: {},
                      },
                      error: null,
                    }
              ),
            })),
          })),
        };
      }
      if (table === "decision_workspace_events") {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      return {};
    }),
  };
}

describe("/api/decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: adminMock({}),
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
    const { GET } = await import("@/app/api/decisions/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/decisions/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns decisions", async () => {
    const { GET } = await import("@/app/api/decisions/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decisions).toHaveLength(1);
  });

  it("POST returns 403 without capability", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/decisions/route");
    const res = await POST(
      new Request("http://localhost:3000/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "X" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST creates decision", async () => {
    const { POST } = await import("@/app/api/decisions/route");
    const res = await POST(
      new Request("http://localhost:3000/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Renewal recommendation" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.decision.id).toBe("d2");
  });

  it("POST returns 400 for unknown decisionType", async () => {
    const { POST } = await import("@/app/api/decisions/route");
    const res = await POST(
      new Request("http://localhost:3000/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "X", decisionType: "not_a_real_type" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toContain("decisionType");
  });

  it("POST accepts amendment_request and requiredInputs", async () => {
    const { POST } = await import("@/app/api/decisions/route");
    const res = await POST(
      new Request("http://localhost:3000/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Amendment path",
          decisionType: "amendment_request",
          requiredInputs: { clause_refs: ["12.1"] },
        }),
      })
    );
    expect(res.status).toBe(201);
  });
});

