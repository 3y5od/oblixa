import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn(async () => null);
const enforceIdempotency = vi.fn(async () => null as Response | null);

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/decisions/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
  });

  it("returns 403 when decision foundation is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/decisions/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/x/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/decisions/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/dec-1/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without approvals_manage capability", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: { from: vi.fn() },
      userId: "u1",
      orgId: "o1",
      role: "viewer",
    });
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/decisions/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/dec-1/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when decision is not open or in_review", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { status: "closed" },
                  error: null,
                })),
              })),
            })),
          })),
        })),
      },
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/decisions/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/dec-1/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(409);
  });

  it("returns idempotency duplicate response", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: { from: vi.fn() },
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(
      NextResponse.json({ error: "Duplicate request blocked by idempotency key" }, { status: 409 })
    );
    const { POST } = await import("@/app/api/decisions/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/dec-1/approve", {
        method: "POST",
        headers: { "x-idempotency-key": "dup-key-1234", "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(409);
  });

  it("approves open decision and records event", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const updated = { id: "dec-1", status: "approved", updated_at: "2026-01-02T00:00:00Z" };
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: vi.fn((table: string) => {
          if (table === "decision_workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { status: "open" },
                      error: null,
                    })),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    in: vi.fn(() => ({
                      select: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({ data: updated, error: null })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "decision_workspace_events") {
            return { insert };
          }
          return {};
        }),
      },
      userId: "actor-1",
      orgId: "org-1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/decisions/[id]/approve/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/dec-1/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "LGTM" }),
      }),
      { params: Promise.resolve({ id: "dec-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.status).toBe("approved");
    expect(insert).toHaveBeenCalled();
    const insertArg = insert.mock.calls.at(0)?.at(0) as unknown as {
      event_type: string;
      payload_json: { prior_status: string; note?: string };
    };
    expect(insertArg.event_type).toBe("decision.approved");
    expect(insertArg.payload_json.prior_status).toBe("open");
    expect(insertArg.payload_json.note).toBe("LGTM");
  });
});
