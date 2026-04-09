import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

describe("GET /api/attestations/run", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/attestations/run/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when capability check fails", async () => {
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, orgId: "org-1", userId: "user-1" });
    canManageCapability.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/attestations/run/route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Access denied" });
  });
});
