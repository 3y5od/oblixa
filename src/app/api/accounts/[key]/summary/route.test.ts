import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext: vi.fn(),
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("GET /api/accounts/[key]/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  it("returns 403 when relationship layer is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/accounts/[key]/summary/route");
    const res = await GET(new Request("http://localhost/api/accounts/acme/summary"), {
      params: Promise.resolve({ key: "acme" }),
    });
    expect(res.status).toBe(403);
  });
});
