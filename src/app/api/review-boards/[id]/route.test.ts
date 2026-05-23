import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const patchReviewBoard = vi.fn();
const incrementV6QualityCounter = vi.fn();
const runIncrementalAssuranceChecks = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

vi.mock("@/lib/v6/review-boards", () => ({
  patchReviewBoard,
}));

vi.mock("@/lib/v6/telemetry", () => ({
  incrementV6QualityCounter,
}));

vi.mock("@/lib/v6/assurance-checks", () => ({
  runIncrementalAssuranceChecks,
}));

describe("PATCH /api/review-boards/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
    patchReviewBoard.mockResolvedValue({ data: { id: "b1" }, error: null });
    incrementV6QualityCounter.mockResolvedValue(undefined);
    runIncrementalAssuranceChecks.mockResolvedValue(undefined);
  });

  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { PATCH } = await import("@/app/api/review-boards/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/b1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce(null);
    const { PATCH } = await import("@/app/api/review-boards/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/b1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without maintenance_manage capability", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ userId: "u1", orgId: "o1" });
    canManageCapability.mockResolvedValueOnce(false);
    const { PATCH } = await import("@/app/api/review-boards/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/b1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns duplicate response before patching a review board", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = {};
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { PATCH } = await import("@/app/api/review-boards/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/b1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "review-board-patch-replay-0001",
        },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: "b1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.review-boards.id",
      actorKey: "o1:u1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(patchReviewBoard).not.toHaveBeenCalled();
  });
});
