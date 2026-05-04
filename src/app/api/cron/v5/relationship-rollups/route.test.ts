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

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5CronFeature: vi.fn(() => null),
}));

vi.mock("@/lib/v5/cron", () => ({
  listOrganizationIds: vi.fn(async () => []),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({ from: vi.fn() })),
}));

describe("GET /api/cron/v5/relationship-rollups", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 401 when cron auth fails", async () => {
    gateCronRequest.mockReturnValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const { GET } = await import("@/app/api/cron/v5/relationship-rollups/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/relationship-rollups"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2700 });
    const { GET } = await import("@/app/api/cron/v5/relationship-rollups/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/relationship-rollups"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Too many requests",
      code: "rate_limited",
      retryAfterMs: 2700,
    });
  });
});
