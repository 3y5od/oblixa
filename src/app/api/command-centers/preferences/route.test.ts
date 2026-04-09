import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

describe("/api/command-centers/preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("GET returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/command-centers/preferences/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/command-centers/preferences/route");
    const res = await POST(new Request("http://localhost/api/command-centers/preferences"));
    expect(res.status).toBe(401);
  });
});
