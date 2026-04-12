import { describe, expect, it, vi } from "vitest";
import { buildSimulationTypeSpecificSignals } from "@/lib/v5/simulation-type-metrics";

describe("buildSimulationTypeSpecificSignals", () => {
  it("returns metrics for campaign_eligibility_impact", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ count: 4, error: null }),
      })),
    };
    const out = await buildSimulationTypeSpecificSignals(
      admin as never,
      "org-1",
      "campaign_eligibility_impact",
      []
    );
    expect(out).toEqual({ active_or_paused_campaigns: 4 });
  });

  it("routing_policy_change_impact uses zero tasks when sample empty", async () => {
    const admin = { from: vi.fn() };
    const out = await buildSimulationTypeSpecificSignals(
      admin as never,
      "org-1",
      "routing_policy_change_impact",
      []
    );
    expect(out).toEqual({
      open_tasks_on_sample_contracts: 0,
      sample_contracts_used: 0,
    });
    expect(admin.from).not.toHaveBeenCalled();
  });
});
