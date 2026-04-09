import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v5/persist-signal-quality", () => ({
  incrementOrgV5SignalQuality: vi.fn(async () => {}),
}));

describe("PATCH /api/intelligence/recommendations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiAuthContext.mockResolvedValue({
      admin: {
        from: vi.fn((table: string) => {
          if (table === "audit_events") {
            return { insert: vi.fn(async () => ({ error: null })) };
          }
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        id: "r1",
                        accepted: true,
                        dismissed: false,
                        recommendation_type: "t",
                        generated_at: new Date().toISOString(),
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }),
      },
      orgId: "org-1",
      userId: "u1",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { PATCH } = await import("@/app/api/intelligence/recommendations/[id]/route");
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("accepts valid action", async () => {
    const { PATCH } = await import("@/app/api/intelligence/recommendations/[id]/route");
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("accept is idempotent (second call still 200)", async () => {
    const { PATCH } = await import("@/app/api/intelligence/recommendations/[id]/route");
    const req = () =>
      PATCH(
        new Request("http://localhost", {
          method: "PATCH",
          body: JSON.stringify({ action: "accept" }),
        }),
        { params: Promise.resolve({ id: "r1" }) }
      );
    expect((await req()).status).toBe(200);
    expect((await req()).status).toBe(200);
  });
});
