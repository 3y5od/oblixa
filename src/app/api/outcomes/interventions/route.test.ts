import { describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/assurance/outcomes", () => ({
  listOutcomeInterventionsPaginated: vi.fn(async () => ({
    rows: [],
    total: 0,
    error: null,
  })),
  computeOutcomeViews: vi.fn(async () => ({
    interventions: [],
    programEffectiveness: [],
    controlEffectiveness: [],
    playbookEffectiveness: [],
    weeklyEffectiveness: [],
    summary: null,
    error: null,
  })),
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: vi.fn(async () => {}),
}));

describe("GET /api/outcomes/interventions", () => {
  it("mocks workspace eligibility guard", () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    expect(requireApiWorkspaceEligibility).toBeDefined();
  });

  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { GET } = await import("@/app/api/outcomes/interventions/route");
    const res = await GET(new Request("http://localhost/api/outcomes/interventions"));
    expect(res.status).toBe(403);
  });

  it("returns paginated shape when enabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    const { GET } = await import("@/app/api/outcomes/interventions/route");
    const res = await GET(new Request("http://localhost/api/outcomes/interventions?limit=10&offset=0"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      interventionsPage: { rows: unknown[]; total: number; limit: number; offset: number };
      interventions: unknown[];
    };
    expect(Array.isArray(body.interventionsPage.rows)).toBe(true);
    expect(typeof body.interventionsPage.total).toBe("number");
    expect(Array.isArray(body.interventions)).toBe(true);
  });
});
