import { beforeEach, describe, expect, it, vi } from "vitest";

const gateCronRequest = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/security/cron-route-gate", () => ({
  gateCronRequest,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v4ProgramReconcileCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

describe("GET /api/cron/v4/programs-reconcile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns unauthorized response from cron guard", async () => {
    gateCronRequest.mockReturnValueOnce(new Response("Unauthorized", { status: 401 }));
    const { GET } = await import("@/app/api/cron/v4/programs-reconcile/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/programs-reconcile"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2300 });
    const { GET } = await import("@/app/api/cron/v4/programs-reconcile/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/programs-reconcile"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Too many requests",
      code: "rate_limited",
      retryAfterMs: 2300,
    });
  });
});
