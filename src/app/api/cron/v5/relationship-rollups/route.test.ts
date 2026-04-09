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

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({ from: vi.fn() })),
}));

describe("GET /api/cron/v5/relationship-rollups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV5CronAuth.mockReturnValue(null);
  });

  it("returns 401 when cron auth fails", async () => {
    requireV5CronAuth.mockReturnValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const { GET } = await import("@/app/api/cron/v5/relationship-rollups/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/relationship-rollups"));
    expect(res.status).toBe(401);
  });
});
