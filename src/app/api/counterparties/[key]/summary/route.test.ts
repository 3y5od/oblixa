import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext: vi.fn(),
}));

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("GET /api/counterparties/[key]/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  it("returns 403 when relationship layer is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/counterparties/[key]/summary/route");
    const res = await GET(new Request("http://localhost/api/counterparties/vendor-a/summary"), {
      params: Promise.resolve({ key: "vendor-a" }),
    });
    expect(res.status).toBe(403);
  });
});
