import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

describe("GET /api/evidence/export/[contractId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/evidence/export/[contractId]/route");
    const res = await GET(new Request("http://localhost/api/evidence/export/c1"), {
      params: Promise.resolve({ contractId: "c1" }),
    });
    expect(res.status).toBe(401);
  });
});
