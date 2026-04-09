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

describe("POST /api/external-actions/create-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      userId: "u1",
      orgId: "o1",
      admin: { from: vi.fn() },
    } as never);
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 403 when external collaboration is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionType: "submit_evidence" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid actionType", async () => {
    const { POST } = await import("@/app/api/external-actions/create-link/route");
    const res = await POST(
      new Request("http://localhost/api/external-actions/create-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionType: "not_valid_external_action" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
