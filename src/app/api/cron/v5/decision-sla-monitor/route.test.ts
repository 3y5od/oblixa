import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gateCronRequest = vi.fn();
const rateLimitCheck = vi.fn();
const enforceIdempotency = vi.fn();
const listOrganizationIds = vi.fn();

vi.mock("@/lib/security/cron-route-gate", () => ({
  gateCronRequest,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v5CronDefault: { max: 60, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5CronFeature: vi.fn(() => null),
}));

vi.mock("@/lib/decision-intelligence/cron", () => ({
  listOrganizationIds,
}));

describe("GET /api/cron/v5/decision-sla-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    enforceIdempotency.mockResolvedValue(null);
    listOrganizationIds.mockResolvedValue([]);
  });

  it("returns 401 when cron auth fails", async () => {
    gateCronRequest.mockReturnValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const { GET } = await import("@/app/api/cron/v5/decision-sla-monitor/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/decision-sla-monitor"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2600 });
    const { GET } = await import("@/app/api/cron/v5/decision-sla-monitor/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/decision-sla-monitor"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Too many requests",
      code: "rate_limited",
      retryAfterMs: 2600,
    });
  });

  it("returns replay response before rate limiting or SLA work", async () => {
    const replay = new Response(JSON.stringify({ error: "Duplicate request" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
    enforceIdempotency.mockResolvedValueOnce(replay);

    const { GET } = await import("@/app/api/cron/v5/decision-sla-monitor/route");
    const res = await GET(
      new Request("http://localhost/api/cron/v5/decision-sla-monitor", {
        headers: { "x-idempotency-key": "decision-sla-cron-replay-0001" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "cron:/api/cron/v5/decision-sla-monitor",
      actorKey: "cron",
    });
    expect(rateLimitCheck).not.toHaveBeenCalled();
    expect(listOrganizationIds).not.toHaveBeenCalled();
  });

  it("returns skipped when feature is disabled", async () => {
    const { requireV5CronFeature } = await import("@/lib/decision-intelligence/feature-guards");
    vi.mocked(requireV5CronFeature).mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/decision-sla-monitor/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/decision-sla-monitor"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });
});
