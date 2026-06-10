import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/decision-intelligence/post-decision-actions", () => ({
  executePostDecisionActions: vi.fn(),
  suggestDefaultPostDecisionActions: vi.fn(() => []),
}));

vi.mock("@/lib/decision-intelligence/relationship-timeline", () => ({
  appendAccountTimelineEvent: vi.fn(),
  appendCounterpartyTimelineEvent: vi.fn(),
}));

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency: (...args: unknown[]) => enforceIdempotency(...args),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("POST /api/decisions/[id]/close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: {},
      orgId: "org_1",
      role: "admin",
      userId: "user_1",
    });
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
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

  it("returns duplicate idempotency response before mutating decision state", async () => {
    enforceIdempotency.mockResolvedValueOnce(
      NextResponse.json({ error: "Duplicate request blocked by idempotency key" }, { status: 409 })
    );
    const { POST } = await import("@/app/api/decisions/[id]/close/route");
    const res = await POST(
      new Request("http://localhost/api/decisions/decision-1/close", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "decision-close-replay-0001",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "decision-1" }) }
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.decisions.id.close",
      actorKey: "org_1:user_1",
    });
  });
});
