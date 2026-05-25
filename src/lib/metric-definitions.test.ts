import { describe, expect, it } from "vitest";
import { V9_METRIC_DEFINITIONS } from "./metric-definitions";
import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";

describe("V9 metric definitions", () => {
  it("defines every allowlisted telemetry action", () => {
    for (const action of PRODUCT_TELEMETRY_ACTIONS) {
      const k = action.replace(/^product\.v9\./, "") as keyof typeof V9_METRIC_DEFINITIONS;
      const def = V9_METRIC_DEFINITIONS[k];
      expect(def, k).toBeDefined();
      expect(String(def).length).toBeGreaterThan(20);
    }
  });

  it("keeps analytical cross-metrics", () => {
    expect(V9_METRIC_DEFINITIONS.time_to_first_contract.length).toBeGreaterThan(30);
    expect(V9_METRIC_DEFINITIONS.review_save_next_used.length).toBeGreaterThan(20);
  });

  it("maps docs §28.1 telemetry bullets to definitions (allowlisted or derived)", () => {
    const keys: (keyof typeof V9_METRIC_DEFINITIONS)[] = [
      "time_to_first_contract",
      "time_to_first_completed_review",
      "time_to_first_visible_work_item",
      "onboarding_checklist_completion_rate",
      "review_queue_completion_rate",
      "work_action_rate",
      "renewal_action_rate",
      "evidence_submission_rate",
      "search_usage",
      "quick_open_usage",
    ];
    for (const k of keys) {
      expect(V9_METRIC_DEFINITIONS[k]?.length).toBeGreaterThan(20);
    }
    const checklist = V9_METRIC_DEFINITIONS.onboarding_checklist_completion_rate;
    expect(checklist).toContain("onboarding_completed");
    expect(checklist).toContain("onboarding_failed");
    expect(checklist).toContain("onboarding_recovered");
    expect(checklist).toContain("onboarding_progressed");
    expect(checklist).toMatch(/completed\s*\/\s*\(completed\s*\+\s*failed\)/);
  });

  it("maps docs §28.2 reliability bullets to definitions", () => {
    const keys: (keyof typeof V9_METRIC_DEFINITIONS)[] = [
      "extraction_success_and_failure_rate",
      "import_completion_rate",
      "visible_mutation_error_rate_on_core_surfaces",
      "reminder_delivery_success_and_failure_rate",
      "export_success_and_failure_rate",
      "page_level_load_duration_for_core_pages",
    ];
    for (const k of keys) {
      expect(V9_METRIC_DEFINITIONS[k]?.length).toBeGreaterThan(20);
    }
    expect(V9_METRIC_DEFINITIONS.extraction_success_and_failure_rate).toMatch(/extraction_(succeeded|failed)/);
    expect(V9_METRIC_DEFINITIONS.import_completion_rate).toMatch(/import_completed/);
    expect(V9_METRIC_DEFINITIONS.visible_mutation_error_rate_on_core_surfaces).toContain("visible_mutation_error");
    expect(V9_METRIC_DEFINITIONS.reminder_delivery_success_and_failure_rate).toMatch(/reminder_(delivered|failed)/);
    expect(V9_METRIC_DEFINITIONS.export_success_and_failure_rate).toMatch(
      /export_(completed|partially_completed|failed)/
    );
    expect(V9_METRIC_DEFINITIONS.page_level_load_duration_for_core_pages).toContain("page_load_measured");
  });
});
