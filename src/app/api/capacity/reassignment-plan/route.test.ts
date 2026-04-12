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

describe("POST /api/capacity/reassignment-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireV5ApiFeature).mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
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
});
