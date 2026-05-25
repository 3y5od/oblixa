import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const sendSlackRenewalDecisionSummary = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/integrations/slack", () => ({
  sendSlackRenewalDecisionSummary,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

describe("POST /api/integrations/slack/renewal-summary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    canManageCapability.mockResolvedValue(true);
    sendSlackRenewalDecisionSummary.mockResolvedValue({ ok: true });
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/integrations/slack/renewal-summary/route");
    const res = await POST(new Request("http://localhost/api/integrations/slack/renewal-summary"));
    expect(res.status).toBe(401);
  });

  it("forwards a schema-compatible renewal summary payload shape to Slack", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "contract-1", title: "MSA" } }),
            })),
          })),
        })),
      })),
    };
    getApiAuthContext.mockResolvedValue({ admin, userId: "user-1", orgId: "org-1", role: "admin" });

    const { POST } = await import("@/app/api/integrations/slack/renewal-summary/route");
    const res = await POST(
      new Request("http://localhost/api/integrations/slack/renewal-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId: "contract-1",
          outcome: "renewed",
          details: "Customer accepted redlines",
        }),
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(sendSlackRenewalDecisionSummary).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        organizationId: "org-1",
        contractId: "contract-1",
        contractTitle: "MSA",
        outcome: "renewed",
        details: "Customer accepted redlines",
      })
    );
  });

  it("blocks duplicate replay of renewal summary with x-idempotency-key", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "contract-1", title: "MSA" } }),
            })),
          })),
        })),
      })),
    };
    getApiAuthContext.mockResolvedValue({ admin, userId: "user-1", orgId: "org-1", role: "admin" });

    const { POST } = await import("@/app/api/integrations/slack/renewal-summary/route");
    const buildRequest = () =>
      new Request("http://localhost/api/integrations/slack/renewal-summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "slack-renewal-replay-0001",
        },
        body: JSON.stringify({
          contractId: "contract-1",
          outcome: "renewed",
          details: "Customer accepted redlines",
        }),
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ ok: true });
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: expect.any(Number),
    });
    expect(sendSlackRenewalDecisionSummary).toHaveBeenCalledTimes(1);
  });
});
