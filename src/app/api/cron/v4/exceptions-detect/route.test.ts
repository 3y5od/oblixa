import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureCronAuthorized = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/v4/cron", () => ({
  ensureCronAuthorized,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v4ExceptionsDetectCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/observability/sentry", () => ({
  captureServerMessage: vi.fn(),
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck: vi.fn(),
}));

describe("GET /api/cron/v4/exceptions-detect", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    ensureCronAuthorized.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns unauthorized response from cron guard", async () => {
    ensureCronAuthorized.mockReturnValueOnce(new Response("Unauthorized", { status: 401 }));
    const { GET } = await import("@/app/api/cron/v4/exceptions-detect/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/exceptions-detect"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2100 });
    const { GET } = await import("@/app/api/cron/v4/exceptions-detect/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/exceptions-detect"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests", retryAfterMs: 2100 });
  });

  it("returns 200 with detected and durationMs when admin client fails", async () => {
    const { createAdminClient } = await import("@/lib/supabase/server");
    vi.mocked(createAdminClient).mockRejectedValueOnce(new Error("supabase unavailable"));
    const { GET } = await import("@/app/api/cron/v4/exceptions-detect/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/exceptions-detect"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.detected).toBe(0);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("detector_failed");
    expect(typeof body.durationMs).toBe("number");
  });
});
