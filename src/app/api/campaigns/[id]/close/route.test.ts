import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/v5/persist-signal-quality", () => ({
  incrementOrgV5SignalQuality: vi.fn(async () => undefined),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/v6/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(async () => undefined),
}));

vi.mock("@/lib/v6/portfolio-metrics", () => ({
  gatherPortfolioMetrics: vi.fn(async () => ({})),
}));

vi.mock("@/lib/v6/outcome-writers", () => ({
  recordCampaignInterventionOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter: vi.fn(async () => undefined),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/campaigns/[id]/close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 403 when portfolio campaigns feature is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/campaigns/[id]/close/route");
    const res = await POST(new Request("http://localhost/api/campaigns/c1/close"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 when caller is unauthenticated", async () => {
    getApiAuthContext.mockResolvedValue(null);
    const { POST } = await import("@/app/api/campaigns/[id]/close/route");
    const res = await POST(new Request("http://localhost/api/campaigns/c1/close"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller lacks maintenance_manage capability", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: {},
      orgId: "org_1",
      role: "editor",
      userId: "u_1",
    });
    canManageCapability.mockResolvedValue(false);
    const { POST } = await import("@/app/api/campaigns/[id]/close/route");
    const res = await POST(new Request("http://localhost/api/campaigns/c1/close"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns workspace eligibility denial response when mode gate blocks", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: {},
      orgId: "org_1",
      role: "editor",
      userId: "u_1",
    });
    requireApiWorkspaceEligibility.mockResolvedValue(
      NextResponse.json({ error: "Not found" }, { status: 404 })
    );
    const { POST } = await import("@/app/api/campaigns/[id]/close/route");
    const res = await POST(new Request("http://localhost/api/campaigns/c1/close"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(404);
  });
});
