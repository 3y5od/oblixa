import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const runChecks = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature: (...args: unknown[]) => requireV6ApiFeature(...args),
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => {}),
}));

vi.mock("@/lib/v6/assurance", () => ({
  runChecks: (...args: unknown[]) => runChecks(...args),
}));

describe("POST /api/assurance/checks/run", () => {
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
    runChecks.mockResolvedValue({
      checkRun: { id: "cr1" },
      finding: null,
      findings: [],
      metrics: {},
      policyResults: [],
      errors: [],
    });
  });

  it("passes session orgId into runChecks", async () => {
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(201);
    expect(runChecks).toHaveBeenCalledWith(expect.anything(), ORG, "user-1");
  });
});
