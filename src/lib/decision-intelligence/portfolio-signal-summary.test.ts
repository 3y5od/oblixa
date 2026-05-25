import { describe, expect, it, vi } from "vitest";
import { buildPortfolioSignalSummary } from "@/lib/decision-intelligence/portfolio-signal-summary";

describe("buildPortfolioSignalSummary", () => {
  it("returns 13 signals and drivers with expected shape", async () => {
    const countRes = { count: 3, error: null };
    const dataRes = { data: [{ id: "camp-1" }], error: null };
    const emptyData = { data: [], error: null };

    function filterBuilder(mode: "count" | "data") {
      const p = Promise.resolve(mode === "count" ? countRes : dataRes);
      const f: Record<string, ReturnType<typeof vi.fn>> = {};
      f.eq = vi.fn(() => f);
      f.in = vi.fn(() => f);
      f.lte = vi.fn(() => f);
      f.lt = vi.fn(() => f);
      f.limit = vi.fn(async () => (mode === "data" ? dataRes : emptyData));
      return Object.assign(f, {
        then: (onFulfilled: (v: unknown) => unknown) => p.then(onFulfilled),
        catch: p.catch.bind(p),
      });
    }

    const adminFrom = vi.fn((table: string) => {
      if (table === "exceptions") {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts?.head) {
              return filterBuilder("count");
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(async () => emptyData),
                })),
              })),
            };
          }),
        };
      }
      if (table === "portfolio_campaigns") {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts?.head) {
              return filterBuilder("count");
            }
            return filterBuilder("data");
          }),
        };
      }
      if (
        table === "decision_workspaces" ||
        table === "attestation_requests" ||
        table === "contract_tasks" ||
        table === "external_action_links" ||
        table === "evidence_requirements" ||
        table === "contract_renewal_checkpoints" ||
        table === "contract_program_assignments" ||
        table === "portfolio_campaign_contracts"
      ) {
        return {
          select: vi.fn(() => filterBuilder("count")),
        };
      }
      if (table === "contract_obligations" || table === "contract_approvals") {
        return {
          select: vi.fn(() => filterBuilder("count")),
        };
      }
      return { select: vi.fn(() => filterBuilder("count")) };
    });

    const { signalSummary, drivers } = await buildPortfolioSignalSummary(
      { from: adminFrom } as never,
      "org-1"
    );

    expect(signalSummary).toHaveLength(13);
    expect(signalSummary[0]).toMatchObject({
      key: "overdue_operational_risk",
      label: "Open exceptions",
      value: 3,
      linked_object: "exceptions",
    });
    expect(drivers.linked_object).toBe("exceptions");
    expect(drivers.reason_json).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "driver", value: "exceptions_by_account" })])
    );
  });
});
