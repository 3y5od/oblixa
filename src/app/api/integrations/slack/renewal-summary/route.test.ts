import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(async () => true),
}));

vi.mock("@/lib/integrations/slack", () => ({
  sendSlackRenewalDecisionSummary: vi.fn(async () => ({ ok: true })),
}));

describe("POST /api/integrations/slack/renewal-summary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/integrations/slack/renewal-summary/route");
    const res = await POST(new Request("http://localhost/api/integrations/slack/renewal-summary"));
    expect(res.status).toBe(401);
  });
});
