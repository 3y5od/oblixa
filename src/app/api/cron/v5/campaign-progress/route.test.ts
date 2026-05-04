import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";

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

const listOrganizationIds = vi.fn(async () => ["org-1"]);

const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/v5/cron", () => ({
  listOrganizationIds,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/v5/persist-signal-quality", () => ({
  incrementOrgV5SignalQuality: vi.fn(async () => {}),
}));

describe("GET /api/cron/v5/campaign-progress", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    vi.mocked(requireV5CronFeature).mockReturnValue(null);
    createAdminClient.mockReset();
  });

  it("returns 401 when cron auth fails", async () => {
    gateCronRequest.mockReturnValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const { GET } = await import("@/app/api/cron/v5/campaign-progress/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/campaign-progress"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2400 });
    const { GET } = await import("@/app/api/cron/v5/campaign-progress/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/campaign-progress"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Too many requests",
      code: "rate_limited",
      retryAfterMs: 2400,
    });
  });

  it("writes progress_summary_json with counts and segment_breakdown shape", async () => {
    const updatePayloads: unknown[] = [];
    let contractSelectCalls = 0;

    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "portfolio_campaigns") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [{ id: "camp-1" }],
                    error: null,
                  })),
                })),
              })),
            })),
            update: vi.fn((payload: unknown) => {
              updatePayloads.push(payload);
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ error: null })),
                })),
              };
            }),
          };
        }
        if (table === "portfolio_campaign_contracts") {
          let segRangeCall = 0;
          return {
            select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact" && opts?.head) {
                contractSelectCalls += 1;
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(async () => ({ count: contractSelectCalls <= 2 ? 1 : 0, error: null })),
                    })),
                  })),
                };
              }
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    range: vi.fn(async () => {
                      segRangeCall += 1;
                      if (segRangeCall === 1) {
                        return {
                          data: [
                            { segment_key: "enterprise", assigned_team: "legal", status: "pending" },
                            { segment_key: "enterprise", assigned_team: "legal", status: "processed" },
                            { segment_key: null, assigned_team: null, status: "failed" },
                          ],
                          error: null,
                        };
                      }
                      return { data: [], error: null };
                    }),
                  })),
                })),
              };
            }),
          };
        }
        return {};
      }),
    } as never);

    const { GET } = await import("@/app/api/cron/v5/campaign-progress/route");
    const res = await GET(new Request("http://localhost/api/cron/v5/campaign-progress"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.campaignsUpdated).toBeGreaterThanOrEqual(1);
    expect(updatePayloads.length).toBeGreaterThanOrEqual(1);
    const summary = (updatePayloads[0] as { progress_summary_json?: Record<string, unknown> })
      .progress_summary_json;
    expect(summary).toMatchObject({
      pending: expect.any(Number),
      in_progress: expect.any(Number),
      processed: expect.any(Number),
      failed: expect.any(Number),
    });
    expect(summary?.segment_breakdown).toBeDefined();
    const seg = summary?.segment_breakdown as Record<string, Record<string, number>>;
    expect(seg.enterprise?.pending).toBe(1);
    expect(seg.enterprise?.processed).toBe(1);
    expect(seg._unsegmented?.failed).toBe(1);
    const teams = summary?.team_breakdown as Record<string, Record<string, number>>;
    expect(teams.legal?.pending).toBe(1);
    expect(teams.legal?.processed).toBe(1);
    expect(teams._unassigned?.failed).toBe(1);
  });
});
