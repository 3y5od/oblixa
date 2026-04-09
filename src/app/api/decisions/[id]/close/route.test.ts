import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext: vi.fn(),
  canManageCapability: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/v5/post-decision-actions", () => ({
  executePostDecisionActions: vi.fn(),
  suggestDefaultPostDecisionActions: vi.fn(() => []),
}));

vi.mock("@/lib/v5/relationship-timeline", () => ({
  appendAccountTimelineEvent: vi.fn(),
  appendCounterpartyTimelineEvent: vi.fn(),
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/decisions/[id]/close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  it("returns 403 when decision foundation is disabled", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { POST } = await import("@/app/api/decisions/[id]/close/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/x/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(403);
  });
});
