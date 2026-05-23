import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const enforceIdempotency = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

describe("POST /api/capacity/reassignment-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireV5ApiFeature).mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
    getApiAuthContext.mockResolvedValue({
      orgId: "o1",
      userId: "u1",
      admin: {
        from: vi.fn(() => ({
          insert: vi.fn(async () => ({ error: null })),
        })),
      },
    });
  });

  it("returns 403 when feature disabled", async () => {
    vi.mocked(requireV5ApiFeature).mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/capacity/reassignment-plan/route");
    const res = await POST(
      new Request("http://localhost/api/capacity/reassignment-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamKey: "ops", currentLoad: 10, targetLoad: 6 }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns reassignment guidance when overload exists", async () => {
    const { POST } = await import("@/app/api/capacity/reassignment-plan/route");
    const res = await POST(
      new Request("http://localhost/api/capacity/reassignment-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamKey: "ops", currentLoad: 10, targetLoad: 6 }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.team_key).toBe("ops");
    expect(body.plan.suggested_moves).toBe(4);
  });

  it("returns duplicate response before generating reassignment guidance", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const insert = vi.fn(async () => ({ error: null }));
    enforceIdempotency.mockResolvedValueOnce(duplicate);
    getApiAuthContext.mockResolvedValueOnce({
      orgId: "o1",
      userId: "u1",
      admin: {
        from: vi.fn(() => ({ insert })),
      },
    });

    const { POST } = await import("@/app/api/capacity/reassignment-plan/route");
    const res = await POST(
      new Request("http://localhost/api/capacity/reassignment-plan", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "capacity-replay-0001" },
        body: JSON.stringify({ teamKey: "ops", currentLoad: 10, targetLoad: 6 }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.capacity.reassignment-plan",
        actorKey: "o1:u1",
      }
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
