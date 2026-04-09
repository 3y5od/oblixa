import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

describe("GET /api/report-packs/[id]/runs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs"), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(401);
  });
});
