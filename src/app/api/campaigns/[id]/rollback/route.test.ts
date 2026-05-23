import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

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

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/campaigns/[id]/rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns 403 when portfolio campaigns flag is off", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/campaigns/[id]/rollback/route");
    const res = await POST(new Request("http://localhost/api/campaigns/c1/rollback"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns duplicate response before rollback side effects", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("@/app/api/campaigns/[id]/rollback/route");
    const res = await POST(
      new Request("http://localhost/api/campaigns/c1/rollback", {
        method: "POST",
        headers: { "x-idempotency-key": "campaign-rollback-replay-0001" },
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.campaigns.id.rollback",
      actorKey: "o1:u1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("returns 409 when campaign already rolled back", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: vi.fn((table: string) => {
          if (table === "portfolio_campaigns") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { id: "c1", status: "paused", rolled_back_at: "2026-01-01T00:00:00Z" },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      },
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/campaigns/[id]/rollback/route");
    const res = await POST(new Request("http://localhost/api/campaigns/c1/rollback"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(409);
  });

  it("returns campaign and tasksRemoved on success", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: vi.fn((table: string) => {
          if (table === "portfolio_campaigns") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { id: "c1", status: "active", rolled_back_at: null },
                      error: null,
                    })),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      select: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: {
                            id: "c1",
                            status: "paused",
                            rolled_back_at: "2026-01-02T00:00:00Z",
                            updated_at: "2026-01-02T00:00:00Z",
                          },
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "contract_tasks") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  like: vi.fn(() => ({
                    limit: vi.fn(async () => ({ data: [{ id: "t1" }], error: null })),
                  })),
                })),
              })),
              delete: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            };
          }
          if (table === "contract_program_assignments") {
            return {
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ error: null })),
                })),
              })),
            };
          }
          if (table === "portfolio_campaign_contracts") {
            return {
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    in: vi.fn(async () => ({ error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "portfolio_campaign_events") {
            return { insert };
          }
          return {};
        }),
      },
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/campaigns/[id]/rollback/route");
    const res = await POST(new Request("http://localhost/api/campaigns/c1/rollback"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasksRemoved).toBe(1);
    expect(body.campaign.status).toBe("paused");
    expect(insert).toHaveBeenCalled();
    const evt = insert.mock.calls.at(0)?.at(0) as unknown as { event_type: string };
    expect(evt.event_type).toBe("campaign.rolled_back");
  });
});
