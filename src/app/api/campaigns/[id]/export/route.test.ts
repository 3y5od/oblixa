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

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

function exportAdminMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "portfolio_campaigns") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "c1",
                    name: "Test",
                    campaign_type: "policy_rollout",
                    status: "active",
                    preview_summary_json: {},
                    progress_summary_json: { pending: 1 },
                    updated_at: "2026-01-01T00:00:00Z",
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "portfolio_campaign_contracts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [
                      {
                        contract_id: "ct-1",
                        status: "pending",
                        segment_key: "s1",
                        assigned_team: "ops",
                        status_reason: "queued",
                        updated_at: "2026-01-01T00:00:00Z",
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

describe("GET /api/campaigns/[id]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    getApiAuthContext.mockResolvedValue({
      admin: exportAdminMock(),
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
  });

  it("returns 403 when flag off", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/campaigns/[id]/export/route");
    const res = await GET(new Request("http://localhost/api/campaigns/c1/export"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns JSON bundle with contracts and exported_at", async () => {
    const { GET } = await import("@/app/api/campaigns/[id]/export/route");
    const res = await GET(new Request("http://localhost/api/campaigns/c1/export"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaign.id).toBe("c1");
    expect(body.contracts).toHaveLength(1);
    expect(body.contracts[0].contract_id).toBe("ct-1");
    expect(typeof body.exported_at).toBe("string");
  });

  it("returns CSV attachment when format=csv", async () => {
    const { GET } = await import("@/app/api/campaigns/[id]/export/route");
    const res = await GET(
      new Request("http://localhost/api/campaigns/c1/export?format=csv"),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("contract_id");
    expect(text).toContain("ct-1");
    expect(text).toContain("pending");
  });
});
