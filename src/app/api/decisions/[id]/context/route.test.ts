import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedGuard = vi.mocked(requireV5ApiFeature);

describe("GET /api/decisions/[id]/context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGuard.mockReturnValue(null);
  });

  it("returns 403 when V5 decision foundation is off", async () => {
    mockedGuard.mockReturnValueOnce(NextResponse.json({ error: "disabled" }, { status: 403 }));
    const { GET } = await import("@/app/api/decisions/[id]/context/route");
    const res = await GET(new Request("http://localhost/api/decisions/x/context"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(403);
  });
});
