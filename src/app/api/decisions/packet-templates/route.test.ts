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

describe("/api/decisions/packet-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  it("GET returns 403 when decision foundation is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/decisions/packet-templates/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
