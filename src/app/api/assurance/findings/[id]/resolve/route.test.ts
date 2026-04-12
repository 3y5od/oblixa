import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const resolveFinding = vi.fn();
const dismissFinding = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature: (...args: unknown[]) => requireV6ApiFeature(...args),
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
}));

vi.mock("@/lib/v6/assurance", () => ({
  resolveFinding: (...args: unknown[]) => resolveFinding(...args),
  dismissFinding: (...args: unknown[]) => dismissFinding(...args),
}));

describe("POST /api/assurance/findings/[id]/resolve", () => {
  const ORG = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    getApiAuthContext.mockResolvedValue({
      admin: {},
      userId: "user-1",
      orgId: ORG,
      role: "admin",
    });
    resolveFinding.mockResolvedValue({ data: { id: "f1" }, error: null });
  });

  it("passes session orgId into resolveFinding", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "find-1" }) }
    );
    expect(res.status).toBe(200);
    expect(resolveFinding).toHaveBeenCalledWith(expect.anything(), ORG, "user-1", "find-1", undefined, null);
  });
});
