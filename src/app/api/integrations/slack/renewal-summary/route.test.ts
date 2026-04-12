import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(async () => true),
}));

vi.mock("@/lib/integrations/slack", () => ({
  sendSlackRenewalDecisionSummary: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

describe("POST /api/integrations/slack/renewal-summary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/integrations/slack/renewal-summary/route");
    const res = await POST(new Request("http://localhost/api/integrations/slack/renewal-summary"));
    expect(res.status).toBe(401);
  });
});
