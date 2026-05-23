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

describe("POST /api/decisions/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireV5ApiFeature).mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns 403 when feature is disabled", async () => {
    vi.mocked(requireV5ApiFeature).mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/decisions/[id]/review/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns duplicate response before applying a review decision", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      orgId: "o1",
      userId: "u1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("@/app/api/decisions/[id]/review/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/review", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "decision-review-replay-0001",
        },
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.decisions.id.review",
      actorKey: "o1:u1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("approves in-review decision", async () => {
    getApiAuthContext.mockResolvedValue({
      orgId: "o1",
      userId: "u1",
      admin: {
        from: vi.fn((table: string) => {
          if (table === "decision_workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { id: "d1", status: "in_review", title: "Decision", owner_user_id: "u2" },
                      error: null,
                    })),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: "d1", status: "approved", updated_at: "2026-01-01T00:00:00Z" },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return { insert: vi.fn(async () => ({ error: null })) };
        }),
      },
    } as never);
    const { POST } = await import("@/app/api/decisions/[id]/review/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/d1/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve", note: "looks good" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.status).toBe("approved");
  });
});
