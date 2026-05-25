import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
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
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
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

  it("POST returns duplicate response before creating a decision", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = adminMock({});
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("@/app/api/decisions/route");
    const res = await POST(
      new Request("http://localhost:3000/api/decisions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "decision-create-replay-0001",
        },
        body: JSON.stringify({ title: "Renewal recommendation" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.decisions",
      actorKey: "org-1:user-1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
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

  it("POST returns 400 for malformed dueAt", async () => {
    const { POST } = await import("@/app/api/decisions/route");
    const res = await POST(
      new Request("http://localhost:3000/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "X", dueAt: "2026-05-01" }),
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      diagnostic_id: "decision_due_at_invalid",
    });
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
