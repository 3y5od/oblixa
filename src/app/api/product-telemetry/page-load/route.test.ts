import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();
const getClientIpFromHeaders = vi.fn();
const rateLimitCheck = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const emitProductTelemetryEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { productV9Telemetry: { max: 60, windowMs: 60_000 } },
  getClientIpFromHeaders,
  rateLimitCheck,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent,
}));

describe("POST /api/product-telemetry/page-load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientIpFromHeaders.mockResolvedValue("127.0.0.1");
    rateLimitCheck.mockResolvedValue({ ok: true });
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns duplicate response before telemetry audit or emit", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    getAuthContext.mockResolvedValueOnce({
      admin: {},
      orgId: "o1",
      user: { id: "u1" },
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("@/app/api/product-telemetry/page-load/route");
    const res = await POST(
      new Request("http://localhost/api/product-telemetry/page-load", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "page-load-replay-0001",
        },
        body: JSON.stringify({ path: "/dashboard", durationMs: 120 }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.product-telemetry.page-load",
      actorKey: "o1:u1",
    });
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(emitProductTelemetryEvent).not.toHaveBeenCalled();
  });
});
