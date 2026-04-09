import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

describe("GET /api/exceptions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/exceptions/route");
    const res = await GET(new Request("http://localhost:3000/api/exceptions"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Not authenticated" });
  });

  it("returns exception list for authenticated user", async () => {
    const success = Promise.resolve({ data: [{ id: "ex-1" }], error: null });
    const afterLimit = { eq: vi.fn(() => success) };
    const qb = {
      select: vi.fn(() => qb),
      eq: vi.fn(() => qb),
      order: vi.fn(() => qb),
      limit: vi.fn(() => afterLimit),
    };

    getApiAuthContext.mockResolvedValueOnce({
      orgId: "org-1",
      admin: {
        from: vi.fn(() => qb),
      },
    });

    const { GET } = await import("@/app/api/exceptions/route");
    const res = await GET(new Request("http://localhost:3000/api/exceptions?status=open"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exceptions: [{ id: "ex-1" }] });
  });
});
