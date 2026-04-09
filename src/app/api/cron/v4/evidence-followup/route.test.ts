import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureCronAuthorized = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/v4/cron", () => ({
  ensureCronAuthorized,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v4EvidenceFollowupCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

describe("GET /api/cron/v4/evidence-followup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    ensureCronAuthorized.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns unauthorized response from cron guard", async () => {
    ensureCronAuthorized.mockReturnValueOnce(new Response("Unauthorized", { status: 401 }));
    const { GET } = await import("@/app/api/cron/v4/evidence-followup/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/evidence-followup"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2200 });
    const { GET } = await import("@/app/api/cron/v4/evidence-followup/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/evidence-followup"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests", retryAfterMs: 2200 });
  });
});
