import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(async () => true),
}));

describe("POST /api/maintenance/campaigns", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/maintenance/campaigns/route");
    const res = await POST(
      new Request("http://localhost/api/maintenance/campaigns", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });
});
