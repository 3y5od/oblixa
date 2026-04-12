import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

function adminMock(opts: { listError?: boolean; insertError?: boolean }) {
  return {
    from: vi.fn((table: string) => {
      if (table === "portfolio_campaigns") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() =>
                  opts.listError
                    ? { data: null, error: { message: "list failed" } }
                    : {
                        data: [
                          {
                            id: "c1",
                            name: "Campaign one",
                            campaign_type: "policy_rollout",
                            status: "draft",
                          },
                        ],
                        error: null,
                      }
                ),
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                opts.insertError
                  ? { data: null, error: { message: "insert failed" } }
                  : {
                      data: {
                        id: "c2",
                        name: "Campaign two",
                        campaign_type: "policy_rollout",
                        status: "draft",
                      },
                      error: null,
                    }
              ),
            })),
          })),
        };
      }
      if (table === "portfolio_campaign_contracts") {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      if (table === "portfolio_campaign_events") {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      return {};
    }),
  };
}

describe("/api/campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: adminMock({}),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("GET returns 403 when V5 portfolio campaigns is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/campaigns/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET returns campaigns", async () => {
    const { GET } = await import("@/app/api/campaigns/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaigns).toHaveLength(1);
  });

  it("POST returns 403 when V5 portfolio campaigns is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(
      new Request("http://localhost:3000/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST requires capability", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(
      new Request("http://localhost:3000/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Q2 remediation" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST creates campaign", async () => {
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(
      new Request("http://localhost:3000/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Q2 remediation", contractIds: ["contract-1"] }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.campaign.id).toBe("c2");
  });

  it("POST returns 400 for invalid campaignType", async () => {
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(
      new Request("http://localhost:3000/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bad", campaignType: "not_valid" }),
      })
    );
    expect(res.status).toBe(400);
  });
});

