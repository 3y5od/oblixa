import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("POST /api/campaigns/[id]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
  });

  it("returns idempotency duplicate response", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: {},
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(
      NextResponse.json({ error: "Duplicate request blocked by idempotency key" }, { status: 409 })
    );
    const { POST } = await import("@/app/api/campaigns/[id]/start/route");
    const res = await POST(
      new Request("http://localhost/api/campaigns/c1/start", {
        method: "POST",
        headers: { "x-idempotency-key": "dup-campaign-1001" },
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(409);
  });
});
