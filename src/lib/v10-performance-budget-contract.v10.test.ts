import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildV10RouteApiInventory } from "./v10-route-api-catalog";
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

  it("ties route inventory rows to explicit V10 budget kinds and thresholds", () => {
    const inventory = buildV10RouteApiInventory();

    expect(inventory.find((row) => row.path === "/dashboard")).toMatchObject({
      performanceBudgetKind: "dashboard",
      queryPlanExpectation: "core_mode_excludes_advanced_assurance_tables",
    });
    expect(inventory.find((row) => row.path === "/contracts")).toMatchObject({
      performanceBudgetKind: "contract_list",
      pageSizeExpectation: V10_PERFORMANCE_BUDGETS.contract_list_pagination_threshold_rows,
      virtualizationThresholdRows: V10_PERFORMANCE_BUDGETS.visible_row_virtualization_threshold_rows,
    });
    expect(inventory.find((row) => row.path === "/api/command-palette/contracts")).toMatchObject({
      performanceBudgetKind: "command_palette",
      debounceWindowMs: {
        min: V10_PERFORMANCE_BUDGETS.command_palette_debounce_min_ms,
        max: V10_PERFORMANCE_BUDGETS.command_palette_debounce_max_ms,
      },
    });
    expect(inventory.find((row) => row.path === "/work")).toMatchObject({
      performanceBudgetKind: "work_review_queue",
    });
  });

  it("keeps performance smoke scaffold route-configurable and preserves dashboard core-mode gating proofs", () => {
    const k6Smoke = readFileSync(join(process.cwd(), "k6/smoke.js"), "utf8");
    const k6Runner = readFileSync(join(process.cwd(), "scripts/k6-smoke-runner.mjs"), "utf8");
    const coreGating = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/dashboard-core-data-gating.test.ts"), "utf8");
    const advancedGating = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/dashboard-advanced-data-gating.test.ts"), "utf8");
    const commandPalette = readFileSync(join(process.cwd(), "src/components/layout/command-palette.tsx"), "utf8");

    expect(k6Smoke).toContain("K6_PATHS");
    expect(k6Smoke).toContain("STAGING_BASE_URL");
    expect(k6Runner).toContain('path.join(root, "k6", "smoke.js")');
    expect(commandPalette).toContain('fetchJson(`/api/command-palette/contracts?q=${encodeURIComponent(q)}`');
    expect(commandPalette).toMatch(/window\.setTimeout\([\s\S]*, 160\);/);
    expect(coreGating).toContain('productSurface.mode === "assurance"');
    expect(coreGating).toContain('.from("assurance_findings")');
    expect(advancedGating).toContain('const isCoreHome = productSurface.mode === "core";');
    expect(advancedGating).toContain("showPortfolioIntel");
  });
});
