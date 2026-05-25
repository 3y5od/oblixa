import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

describe("GET /api/attestations/run", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
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
    expect(await res.json()).toMatchObject({ error: "Forbidden", code: "forbidden" });
  });
});
