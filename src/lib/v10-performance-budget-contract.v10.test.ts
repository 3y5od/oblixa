import { describe, expect, it } from "vitest";
import { V10_PERFORMANCE_BUDGETS } from "./v10-ui-state-contracts";

/**
 * §4.16 / §6.14 numeric budgets are centralized in V10_PERFORMANCE_BUDGETS.
 * Load tests in CI should read these constants so drift fails the perf gate ratchet.
 */
describe("V10 performance budget contract", () => {
  it("pins Core dashboard and contract list budgets from v10.md §4.16", () => {
    expect(V10_PERFORMANCE_BUDGETS.core_dashboard_p75_ms).toBe(800);
    expect(V10_PERFORMANCE_BUDGETS.core_dashboard_p95_ms).toBe(1500);
    expect(V10_PERFORMANCE_BUDGETS.contract_list_p75_ms).toBe(900);
    expect(V10_PERFORMANCE_BUDGETS.contract_list_p95_ms).toBe(1800);
    expect(V10_PERFORMANCE_BUDGETS.command_palette_first_open_p75_ms).toBe(500);
    expect(V10_PERFORMANCE_BUDGETS.work_review_queue_p75_ms).toBe(1000);
  });
});
