import { describe, expect, it, vi } from "vitest";
import { fetchControlRoomDashboardData } from "@/lib/v5/control-room-dashboard";

describe("fetchControlRoomDashboardData", () => {
  it("returns six live cards with metrics", async () => {
    const countRes = { count: 2, error: null };
    const emptyCampaigns = { data: [], error: null };

    function countChain() {
      const f: Record<string, ReturnType<typeof vi.fn>> = {};
      f.eq = vi.fn(() => f);
      f.in = vi.fn(() => f);
      f.lte = vi.fn(() => f);
      f.lt = vi.fn(() => f);
      f.limit = vi.fn(async () => countRes);
      return f;
    }

    const adminFrom = vi.fn((table: string) => {
      if (table === "capacity_forecasts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    { forecast_json: { open_tasks: 100 } },
                    { forecast_json: { open_tasks: 90 } },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "portfolio_campaigns") {
        return {
          select: vi.fn((_c: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts?.head) {
              return countChain();
            }
            return {
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  limit: vi.fn(async () => emptyCampaigns),
                })),
              })),
            };
          }),
        };
      }
      if (table === "exceptions") {
        return {
          select: vi.fn((_c: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts?.head) {
              return countChain();
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            };
          }),
        };
      }
      return {
        select: vi.fn(() => countChain()),
      };
    });

    const { cards } = await fetchControlRoomDashboardData({ from: adminFrom } as never, "org-1");
    expect(cards).toHaveLength(6);
    expect(cards[0].metricLabel).toMatch(/open tasks/);
    expect(cards[4].metricLabel).toContain("Δ");
  });
});
