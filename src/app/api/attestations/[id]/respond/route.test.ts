import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(async () => true),
}));

describe("POST /api/attestations/[id]/respond", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/attestations/[id]/respond/route");
    const res = await POST(new Request("http://localhost/api/attestations/r1/respond"), {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(res.status).toBe(401);
  });
});
