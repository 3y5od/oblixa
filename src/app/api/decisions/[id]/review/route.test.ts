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

describe("POST /api/decisions/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireV5ApiFeature).mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
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
