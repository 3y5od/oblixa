import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6Context = vi.fn();
const requireApiWorkspaceEligibility = vi.fn(async () => null);
const enforceIdempotency = vi.fn(async () => null as Response | null);

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/v6/api-auth", () => ({
  requireV6Context: (...args: unknown[]) => requireV6Context(...args),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

describe("POST /api/review-boards/[id]/generate-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV6Context.mockResolvedValue({
      ctx: { admin: {}, orgId: "o1", userId: "u1", role: "admin" },
      errorResponse: null,
    });
    enforceIdempotency.mockResolvedValue(null);
  });

  it("returns idempotency duplicate response", async () => {
    enforceIdempotency.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Duplicate request blocked by idempotency key" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    );
    const { POST } = await import("@/app/api/review-boards/[id]/generate-run/route");
    const res = await POST(
      new Request("http://localhost/api/review-boards/r1/generate-run", {
        method: "POST",
        headers: { "x-idempotency-key": "dup-review-board-1002" },
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(409);
  });
});
