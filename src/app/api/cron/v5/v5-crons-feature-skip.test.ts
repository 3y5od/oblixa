import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";

const { requireV5CronAuth } = vi.hoisted(() => ({
  requireV5CronAuth: vi.fn(() => null as Response | null),
}));

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5CronFeature: vi.fn(() => null),
}));

vi.mock("@/lib/v5/cron", () => ({
  requireV5CronAuth,
  listOrganizationIds: vi.fn(async () => []),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
          limit: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    })),
  })),
}));

const mockedCronFlag = vi.mocked(requireV5CronFeature);
const cronRequest = () => new Request("http://localhost/api/cron/v5/job");

describe("V5 cron routes return skipped payload when feature is disabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCronFlag.mockReturnValue(null);
  });

  it("campaign-progress", async () => {
    mockedCronFlag.mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/campaign-progress/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });

  it("simulation-snapshots", async () => {
    mockedCronFlag.mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/simulation-snapshots/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });

  it("capacity-forecast-refresh", async () => {
    mockedCronFlag.mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/capacity-forecast-refresh/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });

  it("portfolio-risk-recompute", async () => {
    mockedCronFlag.mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/portfolio-risk-recompute/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });

  it("external-followup", async () => {
    mockedCronFlag.mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/external-followup/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });

  it("recommendation-refresh", async () => {
    mockedCronFlag.mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/recommendation-refresh/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });

  it("relationship-rollups", async () => {
    mockedCronFlag.mockReturnValueOnce(
      NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" })
    );
    const { GET } = await import("@/app/api/cron/v5/relationship-rollups/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });

  it("campaign-progress returns 401 when cron auth fails", async () => {
    requireV5CronAuth.mockReturnValueOnce(
      NextResponse.json({ error: "unauthorized" }, { status: 401 })
    );
    vi.resetModules();
    const { GET } = await import("@/app/api/cron/v5/campaign-progress/route");
    const res = await GET(cronRequest());
    expect(res.status).toBe(401);
  });
});
