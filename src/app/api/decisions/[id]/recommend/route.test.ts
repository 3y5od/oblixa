import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext: vi.fn(),
  canManageCapability: vi.fn(),
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/decisions/[id]/recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  it("returns 403 when decision foundation is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/decisions/[id]/recommend/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/x/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recommendationText: "Proceed" }),
      }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(403);
  });
});
