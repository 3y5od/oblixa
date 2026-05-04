import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gateCronRequest = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/security/cron-route-gate", () => ({
  gateCronRequest,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck,
  };
});

describe("GET /api/cron/v5/capacity-forecast-refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 401 when cron auth fails", async () => {
    gateCronRequest.mockReturnValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const { GET } = await import("@/app/api/cron/v5/capacity-forecast-refresh/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/capacity-forecast-refresh"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2500 });
    const { GET } = await import("@/app/api/cron/v5/capacity-forecast-refresh/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/capacity-forecast-refresh"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Too many requests",
      code: "rate_limited",
      retryAfterMs: 2500,
    });
  });
});