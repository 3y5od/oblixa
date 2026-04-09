import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(async () => true),
}));

describe("POST /api/maintenance/campaigns/[id]/run", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/maintenance/campaigns/[id]/run/route");
    const res = await POST(new Request("http://localhost/api/maintenance/campaigns/m1/run"), {
      params: Promise.resolve({ id: "m1" }),
    });
    expect(res.status).toBe(401);
  });
});
