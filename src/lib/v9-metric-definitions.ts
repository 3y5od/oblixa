import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";

function telemetryKey(action: (typeof PRODUCT_TELEMETRY_ACTIONS)[number]): string {
  return action.replace(/^product\.v9\./, "");
}

const fromAllowlist: Record<string, string> = {};
for (const action of PRODUCT_TELEMETRY_ACTIONS) {
  const k = telemetryKey(action);
  fromAllowlist[k] =
    `Allowlisted audit_events.action "${action}"; emit only non-PII details; see v9-metric-definitions + callers.`;
}

/**
 * Canonical V9 metric/event definitions (plan §28.1–28.2).
 * Analytical metrics that are not literal `product.v9.*` strings are documented here and
 * cross-linked to their derived sources where applicable.
 */
export const V9_METRIC_DEFINITIONS: Record<string, string> = {
  ...fromAllowlist,
  time_to_first_contract:
    "Elapsed from first-value path entry until the first contract row is visible; derived from product.v9.first_contract_created.",
  time_to_first_completed_review:
    "Elapsed until the first review completion milestone; derived from product.v9.first_review_completed.",
  time_to_first_visible_work_item:
    "Elapsed until the first actionable work row for the user; derived from product.v9.first_visible_work_item.",
  onboarding_checklist_completion_rate:
    "Per-org checklist completion proxy: completed / (completed + failed) with recovered/progressed as funnel context; derived from product.v9.onboarding_completed, onboarding_failed, onboarding_recovered, onboarding_progressed (offline analytics).",
  review_queue_completion_rate:
    "Derived from review_item_* and first_review_completed signals (offline analytics).",
  work_action_rate:
    "Derived from work_action_succeeded counts (offline analytics).",
  renewal_action_rate:
    "Derived from renewal_action_taken counts (offline analytics).",
  evidence_submission_rate:
    "Derived from evidence_submitted / evidence_resubmitted (offline analytics).",
  search_usage:
    "Derived from cmdk_result_selected + cmdk_zero_results (offline analytics).",
  quick_open_usage:
    "Derived from cmdk_palette_opened + cmdk_result_selected (offline analytics).",
  extraction_success_and_failure_rate:
    "Derived from product.v9.extraction_succeeded + product.v9.extraction_failed (offline analytics).",
  import_completion_rate:
    "Derived from product.v9.import_completed vs import_failed / import_partially_completed (offline analytics).",
  visible_mutation_error_rate_on_core_surfaces:
    "Derived from product.v9.visible_mutation_error counts by surface (offline analytics).",
  reminder_delivery_success_and_failure_rate:
    "Derived from product.v9.reminder_delivered + reminder_failed + reminder_suppressed + reminder_retried (offline analytics).",
  export_success_and_failure_rate:
    "Derived from product.v9.export_completed + export_partially_completed + export_failed (offline analytics).",
  page_level_load_duration_for_core_pages:
    "Derived from product.v9.page_load_measured path + duration_ms histograms (offline analytics).",
};

export type V9MetricDefinitionKey = keyof typeof V9_METRIC_DEFINITIONS;
