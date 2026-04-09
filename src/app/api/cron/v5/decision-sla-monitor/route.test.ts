import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5CronFeature: vi.fn(() => null),
}));

const requireV5CronAuth = vi.fn();
vi.mock("@/lib/v5/cron", () => ({
  requireV5CronAuth,
  listOrganizationIds: vi.fn(async () => []),
}));

describe("GET /api/cron/v5/decision-sla-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV5CronAuth.mockReturnValue(null);
  });

  it("returns 401 when cron auth fails", async () => {
    requireV5CronAuth.mockReturnValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const { GET } = await import("@/app/api/cron/v5/decision-sla-monitor/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/decision-sla-monitor"));
    expect(res.status).toBe(401);
  });

  it("returns skipped when feature is disabled", async () => {
    const { requireV5CronFeature } = await import("@/lib/v5/feature-guards");
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
